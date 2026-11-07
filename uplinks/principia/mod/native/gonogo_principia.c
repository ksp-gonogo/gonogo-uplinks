/*
 * Runs a private copy of the player's Principia build inside the game's process,
 * so a prediction can start from a state the operator's command centre last heard.
 *
 * Principia allows one plugin per copy of its library, so the build is copied to a
 * file of its own, loaded with RTLD_DEEPBIND so it binds to its own globals rather
 * than the player's copy's, and the file is deleted once mapped. The player's plugin
 * is never touched. dlmopen would avoid the file, but a namespace cannot be given
 * back: dlclose leaves it allocated, and the static TLS runs out after twelve.
 *
 * A copy is never closed: its library keeps thread pools alive past any plugin, so
 * unloading it would leave threads on unmapped code. A restart deletes the plugin and
 * builds a new one in the same copy, which leaks nothing. Only a fatal check costs a
 * copy.
 *
 * Every call into the copy runs on a thread of this library's. Mono and Unity never
 * have frames on it, so a fatal check can be jumped out of with no managed frame
 * unwound. Recovery abandons the copy, because its locks and heap are in an unknown
 * state, and the next request opens a new one.
 *
 * A fatal check is a SIGABRT, and that signal is shared with the rest of the process,
 * so the handler looks at where it came from:
 *   - on this library's call thread, inside a call: jump out
 *   - on any other thread with the copy's code on its stack, one of the copy's own
 *     pool threads: that thread is parked for good and the copy is abandoned
 *   - anything else: whoever had the signal before, as if this library were not here
 * The player's own Principia aborting is the third case, and it aborts as it always has.
 *
 * Not covered, and it cannot be from a signal handler: a wild write in the copy, since
 * it shares an address space with the game.
 *
 * Request and reply are plain text, so the C# side needs no struct marshalling here.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <execinfo.h>
#include <link.h>
#include <locale.h>
#include <math.h>
#include <pthread.h>
#include <setjmp.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

/* The game's container has an older C library than a build machine does. */
__asm__(".symver dlopen,dlopen@GLIBC_2.2.5");
__asm__(".symver dlsym,dlsym@GLIBC_2.2.5");
__asm__(".symver dlclose,dlclose@GLIBC_2.2.5");
__asm__(".symver dlerror,dlerror@GLIBC_2.2.5");
__asm__(".symver dlinfo,dlinfo@GLIBC_2.3.3");
__asm__(".symver dladdr1,dladdr1@GLIBC_2.3.3");
__asm__(".symver pthread_create,pthread_create@GLIBC_2.2.5");
__asm__(".symver pthread_detach,pthread_detach@GLIBC_2.2.5");
__asm__(".symver backtrace,backtrace@GLIBC_2.2.5");
__asm__(".symver pthread_attr_setstacksize,pthread_attr_setstacksize@GLIBC_2.2.5");

typedef struct { double x, y, z; } XYZ;
typedef struct { XYZ q, p; } QP;
typedef struct { double eccentricity, semimajor_axis, mean_motion, inclination, lan, argp, mean_anomaly; } Keplerian;
typedef struct { const char *degree, *order, *cos, *j, *sin; } GeoElement;
typedef struct {
    const char *name, *gm, *reference_instant, *min_radius, *mean_radius, *max_radius, *atmosphere_depth;
    bool has_ocean;
    const char *ra, *dec, *reference_angle, *angular_frequency, *reference_radius, *j2;
    const GeoElement *const *geopotential;
} BodyParameters;
typedef struct { const char *a, *b; } TwoStrings;
typedef struct { const char *a, *b, *c; } ThreeStrings;
typedef struct { const char *a; } OneString;
typedef struct { int extension, centre_index; const void *const *primary, *const *secondary; } PlottingFrame;

typedef struct {
    void *handle;
    struct link_map *map;
    void *plugin;
    double reached_vessels;
    int vessels;
    char *system;
    volatile bool poisoned;
    void *(*new_plugin)(const char *, const char *, double);
    void (*delete_plugin)(void **);
    void (*init_ephemeris)(void *, const TwoStrings *, const TwoStrings *);
    void (*init_history)(void *, const TwoStrings *);
    void (*init_psychohistory)(void *, const ThreeStrings *);
    void (*init_downsampling)(void *, const OneString *);
    void (*insert_keplerian)(void *, int, const int *, const BodyParameters *, const Keplerian *);
    void (*insert_cartesian)(void *, int, const int *, const BodyParameters *, const char *, const char *, const char *, const char *, const char *, const char *);
    void (*end_initialization)(void *);
    void (*advance)(void *, double, double);
    double (*current_time)(void *);
    void (*keep_vessel)(void *, const char *, const char *, int, bool, bool *);
    void (*insert_part)(void *, uint32_t, const char *, const char *, QP);
    void (*prepare_collisions)(void *);
    void (*free_vessels)(void *, double);
    void (*catch_up)(void *, void **);
    void (*set_frame)(void *, const PlottingFrame *);
    void (*plan_create)(void *, const char *, double, double);
    double (*plan_final)(void *, const char *);
    void *(*plan_segment)(void *, const char *, XYZ, int);
    bool (*at_end)(void *);
    void (*increment)(void *);
    QP (*get_qp)(void *);
    double (*get_time)(void *);
    void (*delete_iterator)(void **);
    void (*suppress)(int);
    void (*stderr_logging)(int);
} Copy;

#define MAX_TRACKED 64

/* Each abandoned copy keeps about 25 MB and its pool threads until the game exits. */
#define MAX_RECOVERIES 8

static struct link_map *volatile tracked[MAX_TRACKED];
static Copy *volatile tracked_copy[MAX_TRACKED];
static volatile int tracked_count;

static __thread sigjmp_buf recover;
static __thread volatile sig_atomic_t in_call;
static struct sigaction previous_abort;

static int recoveries;
static int restarts;

static void on_abort(int signal_number, siginfo_t *info, void *context)
{
    (void)info;
    (void)context;
    if (in_call) {
        in_call = 0;
        siglongjmp(recover, 1);
    }

    void *frames[64];
    int depth = backtrace(frames, 64);
    for (int i = 0; i < depth; i++) {
        Dl_info where;
        struct link_map *map = NULL;
        if (!dladdr1(frames[i], &where, (void **)&map, RTLD_DL_LINKMAP) || map == NULL) {
            continue;
        }
        for (int t = 0; t < tracked_count; t++) {
            if (tracked[t] == map) {
                tracked_copy[t]->poisoned = true;
                for (;;) {
                    pause();
                }
            }
        }
    }

    sigaction(SIGABRT, &previous_abort, NULL);
    raise(signal_number);
}

#define SYMBOL(field, name)                                                  \
    do {                                                                     \
        *(void **)&copy->field = dlsym(copy->handle, "principia__" name);    \
        if (copy->field == NULL) {                                           \
            *missing = name;                                                 \
            return false;                                                    \
        }                                                                    \
    } while (0)

static bool bind_symbols(Copy *copy, const char **missing)
{
    SYMBOL(new_plugin, "NewPlugin");
    SYMBOL(delete_plugin, "DeletePlugin");
    SYMBOL(init_ephemeris, "InitializeEphemerisParameters");
    SYMBOL(init_history, "InitializeHistoryParameters");
    SYMBOL(init_psychohistory, "InitializePsychohistoryParameters");
    SYMBOL(init_downsampling, "InitializeDownsamplingParameters");
    SYMBOL(insert_keplerian, "InsertCelestialJacobiKeplerian");
    SYMBOL(insert_cartesian, "InsertCelestialAbsoluteCartesian");
    SYMBOL(end_initialization, "EndInitialization");
    SYMBOL(advance, "AdvanceTime");
    SYMBOL(current_time, "CurrentTime");
    SYMBOL(keep_vessel, "InsertOrKeepVessel");
    SYMBOL(insert_part, "InsertUnloadedPart");
    SYMBOL(prepare_collisions, "PrepareToReportCollisions");
    SYMBOL(free_vessels, "FreeVesselsAndPartsAndCollectPileUps");
    SYMBOL(catch_up, "CatchUpLaggingVessels");
    SYMBOL(set_frame, "SetPlottingFrame");
    SYMBOL(plan_create, "FlightPlanCreate");
    SYMBOL(plan_final, "FlightPlanGetActualFinalTime");
    SYMBOL(plan_segment, "FlightPlanRenderedSegment");
    SYMBOL(at_end, "IteratorAtEnd");
    SYMBOL(increment, "IteratorIncrement");
    SYMBOL(get_qp, "IteratorGetDiscreteTrajectoryQP");
    SYMBOL(get_time, "IteratorGetDiscreteTrajectoryTime");
    SYMBOL(delete_iterator, "IteratorDelete");
    SYMBOL(suppress, "SetSuppressedLogging");
    SYMBOL(stderr_logging, "SetStderrLogging");
    return true;
}

/* Splits a line on tabs in place. An empty field is NULL. */
static int split(char *line, char **fields, int capacity)
{
    int count = 0;
    char *cursor = line;
    while (count < capacity) {
        char *tab = strchr(cursor, '\t');
        if (tab != NULL) {
            *tab = '\0';
        }
        fields[count++] = *cursor == '\0' ? NULL : cursor;
        if (tab == NULL) {
            break;
        }
        cursor = tab + 1;
    }
    return count;
}

typedef struct {
    int index;
    int parent;
    bool has_parent;
    BodyParameters parameters;
    bool has_elements;
    Keplerian elements;
    char *cartesian[6];
    bool has_cartesian;
    const GeoElement **geopotential;
    GeoElement *rows;
    int row_count;
} Body;

static void build_plugin(Copy *copy, char *system)
{
    Body *bodies = calloc(256, sizeof(Body));
    int body_count = 0;
    Body *body = NULL;
    char *cursor = system;
    while (cursor != NULL && *cursor != '\0') {
        char *newline = strchr(cursor, '\n');
        if (newline != NULL) {
            *newline = '\0';
        }
        char *f[18] = {0};
        int n = split(cursor, f, 18);
        char kind = f[0] == NULL ? '\0' : f[0][0];
        if (kind == 'S' && n >= 4) {
            copy->plugin = copy->new_plugin(f[1], f[2], strtod(f[3], NULL));
        } else if (kind == 'D') {
            OneString p = {f[1]};
            copy->init_downsampling(copy->plugin, &p);
        } else if (kind == 'H') {
            TwoStrings p = {f[1], f[2]};
            copy->init_history(copy->plugin, &p);
        } else if (kind == 'A') {
            TwoStrings accuracy = {f[1], f[2]};
            TwoStrings step = {f[3], f[4]};
            copy->init_ephemeris(copy->plugin, &accuracy, &step);
        } else if (kind == 'Y') {
            ThreeStrings p = {f[1], f[2], f[3]};
            copy->init_psychohistory(copy->plugin, &p);
        } else if (kind == 'B' && n >= 17 && body_count < 256) {
            body = &bodies[body_count++];
            body->index = (int)strtod(f[1], NULL);
            body->has_parent = f[2] != NULL;
            body->parent = f[2] == NULL ? 0 : (int)strtod(f[2], NULL);
            BodyParameters p = {f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10] != NULL && f[10][0] == '1',
                                f[11], f[12], f[13], f[14], f[15], f[16], NULL};
            body->parameters = p;
        } else if (kind == 'E' && body != NULL && n >= 7) {
            Keplerian e = {strtod(f[1], NULL), NAN, strtod(f[2], NULL), strtod(f[3], NULL),
                           strtod(f[4], NULL), strtod(f[5], NULL), strtod(f[6], NULL)};
            body->elements = e;
            body->has_elements = true;
        } else if (kind == 'C' && body != NULL && n >= 7) {
            for (int i = 0; i < 6; i++) {
                body->cartesian[i] = f[i + 1];
            }
            body->has_cartesian = true;
        } else if (kind == 'G' && body != NULL && n >= 6) {
            body->rows = realloc(body->rows, sizeof(GeoElement) * (size_t)(body->row_count + 1));
            GeoElement row = {f[1], f[2], f[3], f[4], f[5]};
            body->rows[body->row_count++] = row;
        }
        cursor = newline == NULL ? NULL : newline + 1;
    }

    for (int i = 0; i < body_count; i++) {
        Body *b = &bodies[i];
        if (b->row_count > 0) {
            b->geopotential = calloc((size_t)b->row_count + 1, sizeof(GeoElement *));
            for (int r = 0; r < b->row_count; r++) {
                b->geopotential[r] = &b->rows[r];
            }
            b->parameters.geopotential = b->geopotential;
        }
        const int *parent = b->has_parent ? &b->parent : NULL;
        if (b->has_cartesian) {
            copy->insert_cartesian(copy->plugin, b->index, parent, &b->parameters,
                                   b->cartesian[0], b->cartesian[1], b->cartesian[2],
                                   b->cartesian[3], b->cartesian[4], b->cartesian[5]);
        } else {
            copy->insert_keplerian(copy->plugin, b->index, parent, &b->parameters,
                                   b->has_elements ? &b->elements : NULL);
        }
    }
    copy->end_initialization(copy->plugin);
    for (int i = 0; i < body_count; i++) {
        free(bodies[i].rows);
        free(bodies[i].geopotential);
    }
    free(bodies);
}

static char *refusal(const char *why)
{
    char *reply = malloc(strlen(why) + 64);
    sprintf(reply, "{\"ok\": false, \"reason\": \"%s\"}", why);
    return reply;
}

typedef struct { double t, x, y, z, vx, vy, vz; } Point;

static char *format_reply(double reached, const Point *points, int count, int max_points)
{
    int keep = max_points > 1 && count > max_points ? max_points : count;
    size_t capacity = (size_t)keep * 7 * 28 + 128;
    char *reply = malloc(capacity);
    size_t at = (size_t)snprintf(reply, capacity, "{\"ok\": true, \"reachedUt\": %.17g, \"points\": \"", reached);
    for (int k = 0; k < keep; k++) {
        const Point *p = &points[keep > 1 ? ((int64_t)k * (count - 1)) / (keep - 1) : 0];
        at += (size_t)snprintf(reply + at, capacity - at, "%s%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g",
                               k == 0 ? "" : ";", p->t, p->x, p->y, p->z, p->vx, p->vy, p->vz);
    }
    snprintf(reply + at, capacity - at, "\"}");
    return reply;
}

static char *propagate(Copy *copy, double seed_ut, int parent, QP seed, double to_ut, int max_points, double rotation)
{
    void *plugin = copy->plugin;
    if (seed_ut > copy->current_time(plugin)) {
        copy->advance(plugin, seed_ut, rotation);
    }

    char guid[64];
    snprintf(guid, sizeof guid, "00000000-0000-0000-0000-%012d", ++copy->vessels);
    bool inserted = false;
    copy->keep_vessel(plugin, guid, "gonogo seed", parent, false, &inserted);
    copy->insert_part(plugin, (uint32_t)copy->vessels, "gonogo seed", guid, seed);
    copy->prepare_collisions(plugin);
    copy->free_vessels(plugin, 0.02);
    void *collided = NULL;
    copy->catch_up(plugin, &collided);
    if (collided != NULL) {
        copy->delete_iterator(&collided);
    }

    const void *terminator[1] = {NULL};
    PlottingFrame frame = {6000, parent, terminator, terminator};
    copy->set_frame(plugin, &frame);

    copy->plan_create(plugin, guid, to_ut, 1.0);
    double reached = copy->plan_final(plugin, guid);
    XYZ sun = {0, 0, 0};
    void *iterator = copy->plan_segment(plugin, guid, sun, 0);

    int capacity = 1024;
    int count = 0;
    Point *points = malloc(sizeof(Point) * (size_t)capacity);
    while (!copy->at_end(iterator)) {
        if (count == capacity) {
            capacity *= 2;
            points = realloc(points, sizeof(Point) * (size_t)capacity);
        }
        QP qp = copy->get_qp(iterator);
        Point p = {copy->get_time(iterator), qp.q.x, qp.q.y, qp.q.z, 0, 0, 0};
        points[count++] = p;
        copy->increment(iterator);
    }
    copy->delete_iterator(&iterator);

    /*
     * The rendered frame is fixed at the plugin's current time, so the first point
     * being the seed says where its origin is. World swaps y and z against the frame
     * the game's orbit vectors are in. A rendered point's velocity is not in the axes
     * of its position, so velocity comes from the dense path, the seed's own first.
     */
    if (count > 0) {
        double ox = points[0].x - seed.q.x;
        double oy = points[0].y - seed.q.z;
        double oz = points[0].z - seed.q.y;
        for (int i = 0; i < count; i++) {
            double y = points[i].y;
            points[i].x -= ox;
            points[i].y = points[i].z - oz;
            points[i].z = y - oy;
        }
        for (int i = 0; i < count; i++) {
            if (i == 0) {
                points[i].vx = seed.p.x;
                points[i].vy = seed.p.y;
                points[i].vz = seed.p.z;
                continue;
            }
            const Point *before = &points[i - 1];
            const Point *after = &points[i + 1 < count ? i + 1 : i];
            double dt = after->t - before->t;
            points[i].vx = (after->x - before->x) / dt;
            points[i].vy = (after->y - before->y) / dt;
            points[i].vz = (after->z - before->z) / dt;
        }
    }

    for (int i = 0; i < count; i++) {
        if (!isfinite(points[i].x + points[i].y + points[i].z)) {
            free(points);
            return refusal("Principia returned a path with no numbers in it");
        }
    }
    char *reply = format_reply(reached, points, count, max_points);
    free(points);
    return reply;
}

static pthread_mutex_t gate = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t changed = PTHREAD_COND_INITIALIZER;
static char *job;
static char *answer;
static bool thread_running;
static bool serving;
static Copy *current;
static uint64_t thread_generation;

/* A new inode each time: loading a path whose inode is still mapped would hand back that mapping. */
static bool write_private_file(const char *library, const char *directory, char *path, size_t capacity)
{
    static int counter;
    snprintf(path, capacity, "%s/gonogo-principia-%d-%d.so", directory, (int)getpid(), ++counter);
    int in = open(library, O_RDONLY);
    if (in < 0) {
        return false;
    }
    int out = open(path, O_WRONLY | O_CREAT | O_EXCL, 0700);
    if (out < 0) {
        close(in);
        return false;
    }
    enum { CHUNK = 1 << 20 };
    char *buffer = malloc(CHUNK);
    bool good = true;
    for (;;) {
        ssize_t got = read(in, buffer, CHUNK);
        if (got == 0) {
            break;
        }
        if (got < 0 || write(out, buffer, (size_t)got) != got) {
            good = false;
            break;
        }
    }
    free(buffer);
    close(in);
    close(out);
    if (!good) {
        unlink(path);
    }
    return good;
}

static Copy *open_copy(const char *library, const char *directory, const char **why)
{
    if (tracked_count >= MAX_TRACKED || recoveries >= MAX_RECOVERIES) {
        *why = "the private copy of Principia has failed too often in this session";
        return NULL;
    }
    char path[4096];
    if (!write_private_file(library, directory, path, sizeof path)) {
        *why = "no room to make a private copy of Principia";
        return NULL;
    }
    Copy *copy = calloc(1, sizeof(Copy));
    copy->handle = dlopen(path, RTLD_NOW | RTLD_LOCAL | RTLD_DEEPBIND);
    unlink(path);
    if (copy->handle == NULL) {
        free(copy);
        *why = "the private copy of Principia could not be loaded";
        return NULL;
    }
    const char *missing = NULL;
    if (!bind_symbols(copy, &missing)) {
        dlclose(copy->handle);
        free(copy);
        *why = "this Principia build lacks a call the prediction needs";
        return NULL;
    }
    dlinfo(copy->handle, RTLD_DI_LINKMAP, (void *)&copy->map);
    tracked[tracked_count] = copy->map;
    tracked_copy[tracked_count] = copy;
    tracked_count++;
    copy->suppress(3);
    copy->stderr_logging(3);
    return copy;
}

static __thread uint64_t my_generation;

/* The stuck-thread case below moves on without this thread, so only the live thread may change `current`. */
static void set_current(Copy *copy)
{
    if (my_generation == thread_generation) {
        current = copy;
    }
}

/* What a request says when it asks only about the machine, answered from the player's own loaded copy. */
static char *cpu_flags(const char *library)
{
    void *loaded = dlopen(library, RTLD_NOW | RTLD_NOLOAD);
    if (loaded == NULL) {
        return refusal("the build is not loaded");
    }
    void (*flags)(bool *, bool *) = NULL;
    *(void **)&flags = dlsym(loaded, "principia__GetCPUIDFeatureFlags");
    bool has_avx = false;
    bool has_fma = false;
    if (flags != NULL) {
        flags(&has_avx, &has_fma);
    }
    dlclose(loaded);
    if (flags == NULL) {
        return refusal("the build does not report its CPU flags");
    }
    char *reply = malloc(64);
    sprintf(reply, "{\"ok\": true, \"hasFma\": %s}", has_fma ? "true" : "false");
    return reply;
}

/*
 * First line, tab separated: P, library, seed UT, parent, six state numbers, end UT,
 * max points, rotation, a directory for the private file. The rest is the system.
 * Or F, library: the CPU flags. Or X, library, directory: force a fatal check, so
 * recovery can be shown working in the real game.
 */
static char *serve(char *request)
{
    char *newline = strchr(request, '\n');
    if (newline != NULL) {
        *newline = '\0';
    }
    char *f[16] = {0};
    int n = split(request, f, 16);
    const char *why = NULL;

    if (n >= 2 && f[0] != NULL && f[0][0] == 'F') {
        return cpu_flags(f[1]);
    }

    if (n >= 3 && f[0] != NULL && f[0][0] == 'X') {
        Copy *volatile copy = current;
        if (copy == NULL) {
            copy = open_copy(f[1], f[2], &why);
            if (copy == NULL) {
                return refusal(why);
            }
            set_current(copy);
        }
        if (sigsetjmp(recover, 1) == 0) {
            in_call = 1;
            copy->current_time(NULL);
            in_call = 0;
            return refusal("the forced check did not fire");
        }
        recoveries++;
        set_current(NULL);
        return refusal("a fatal check in the private copy was caught");
    }

    if (newline == NULL || n < 14 || f[0] == NULL || f[0][0] != 'P') {
        return refusal("the request could not be read");
    }
    const char *library = f[1];
    double seed_ut = strtod(f[2], NULL);
    int parent = (int)strtod(f[3], NULL);
    QP seed = {{strtod(f[4], NULL), strtod(f[5], NULL), strtod(f[6], NULL)},
               {strtod(f[7], NULL), strtod(f[8], NULL), strtod(f[9], NULL)}};
    double to_ut = strtod(f[10], NULL);
    int max_points = (int)strtod(f[11], NULL);
    double rotation = strtod(f[12], NULL);
    const char *directory = f[13];
    const char *system = newline + 1;

    Copy *volatile copy = current;
    if (sigsetjmp(recover, 1) == 0) {
        in_call = 1;
        if (copy != NULL && copy->plugin != NULL
            && (strcmp(copy->system, system) != 0 || seed_ut < copy->current_time(copy->plugin))) {
            /* A plugin only moves forward, and only one may exist in a copy at a time. */
            copy->delete_plugin(&copy->plugin);
            copy->plugin = NULL;
            free(copy->system);
            copy->system = NULL;
            restarts++;
        }
        if (copy == NULL) {
            in_call = 0;
            copy = open_copy(library, directory, &why);
            if (copy == NULL) {
                return refusal(why);
            }
            set_current(copy);
            in_call = 1;
        }
        if (copy->plugin == NULL) {
            copy->system = strdup(system);
            char *working = strdup(system);
            build_plugin(copy, working);
            /* The strings have been copied by now. */
            free(working);
        }
        char *reply = propagate(copy, seed_ut, parent, seed, to_ut, max_points, rotation);
        in_call = 0;
        return reply;
    }
    recoveries++;
    set_current(NULL);
    return refusal("a fatal check in the private copy was caught, and it has been set aside");
}

typedef struct { uint64_t generation; } ThreadArgument;

static void *call_thread(void *argument)
{
    uint64_t generation = ((ThreadArgument *)argument)->generation;
    my_generation = generation;
    free(argument);
    locale_t c_locale = newlocale(LC_ALL_MASK, "C", (locale_t)0);
    uselocale(c_locale);
    pthread_mutex_lock(&gate);
    for (;;) {
        while (job == NULL) {
            if (thread_generation != generation) {
                pthread_mutex_unlock(&gate);
                return NULL;
            }
            pthread_cond_wait(&changed, &gate);
        }
        char *request = job;
        job = NULL;
        serving = true;
        pthread_mutex_unlock(&gate);
        char *reply = serve(request);
        free(request);
        pthread_mutex_lock(&gate);
        if (thread_generation != generation) {
            /* Given up on while it was stuck: nobody is waiting for this. */
            free(reply);
            pthread_mutex_unlock(&gate);
            return NULL;
        }
        serving = false;
        answer = reply;
        pthread_cond_broadcast(&changed);
    }
}

static void start_thread_locked(void)
{
    ThreadArgument *argument = malloc(sizeof *argument);
    argument->generation = ++thread_generation;
    pthread_t thread;
    pthread_attr_t attributes;
    pthread_attr_init(&attributes);
    pthread_attr_setstacksize(&attributes, 16 * 1024 * 1024);
    pthread_create(&thread, &attributes, call_thread, argument);
    pthread_detach(thread);
    pthread_attr_destroy(&attributes);
    thread_running = true;
}

/* Installs the signal handler. Call once, after the game's own handlers are in place. */
int gonogo_principia_init(void)
{
    void *warm[4];
    backtrace(warm, 4);
    struct sigaction action;
    memset(&action, 0, sizeof action);
    action.sa_sigaction = on_abort;
    action.sa_flags = SA_SIGINFO | SA_NODEFER;
    sigemptyset(&action.sa_mask);
    return sigaction(SIGABRT, &action, &previous_abort);
}

/*
 * One request, one reply, called from any one thread at a time. The reply is freed
 * with gonogo_principia_free. A copy that dies on one of its pool threads leaves the
 * call thread stuck in it, so the wait watches for that and moves to a new thread.
 */
char *gonogo_principia_exchange(const char *request, int timeout_seconds)
{
    pthread_mutex_lock(&gate);
    if (!thread_running) {
        start_thread_locked();
    }
    if (current != NULL && current->poisoned) {
        recoveries++;
        current = NULL;
    }
    job = strdup(request);
    answer = NULL;
    pthread_cond_broadcast(&changed);

    struct timespec deadline;
    clock_gettime(CLOCK_REALTIME, &deadline);
    time_t give_up = deadline.tv_sec + timeout_seconds;
    char *reply = NULL;
    while (answer == NULL) {
        clock_gettime(CLOCK_REALTIME, &deadline);
        bool poisoned = current != NULL && current->poisoned;
        if (poisoned || deadline.tv_sec >= give_up) {
            recoveries++;
            current = NULL;
            free(job);
            job = NULL;
            serving = false;
            start_thread_locked();
            reply = refusal(poisoned
                ? "a fatal check on a thread of the private copy was caught, and it has been set aside"
                : "the private copy of Principia did not answer in time, and it has been set aside");
            break;
        }
        deadline.tv_sec += 1;
        pthread_cond_timedwait(&changed, &gate, &deadline);
    }
    if (reply == NULL) {
        reply = answer;
        answer = NULL;
    }
    pthread_mutex_unlock(&gate);
    return reply;
}

void gonogo_principia_free(char *reply)
{
    free(reply);
}

int gonogo_principia_recoveries(void)
{
    return recoveries;
}

int gonogo_principia_restarts(void)
{
    return restarts;
}

/* For a test: a fatal check on a thread that is not the call thread, with the copy's code on its stack. */
static void *check_off_thread(void *argument)
{
    Copy *copy = argument;
    copy->current_time(NULL);
    return NULL;
}

int gonogo_principia_force_check_off_thread(void)
{
    pthread_mutex_lock(&gate);
    Copy *copy = current;
    pthread_mutex_unlock(&gate);
    if (copy == NULL) {
        return -1;
    }
    pthread_t thread;
    pthread_create(&thread, NULL, check_off_thread, copy);
    pthread_detach(thread);
    return 0;
}
