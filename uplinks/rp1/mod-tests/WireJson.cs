using System;
using System.Reflection;
using System.Text;

/// <summary>
/// A payload written by the host's own serializer, the code that turns what a
/// provider hands over into the JSON on the wire. It is internal to
/// <c>Sitrep.Contract</c>, so it is reached by reflection: a test that built
/// its own expectation of the shape would pass on the very payload the real
/// writer rejects, which is how a typed dictionary reached a running game.
/// </summary>
internal static class WireJson
{
    private static readonly MethodInfo AppendValue = Resolve();

    private static MethodInfo Resolve()
    {
        var writer = typeof(Sitrep.Contract.CommandResult).Assembly
            .GetType("Sitrep.Contract.Serialization.JsonWriter", throwOnError: true)!;
        return writer.GetMethod(
                "AppendValue",
                BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("JsonWriter.AppendValue is not where the tests look for it");
    }

    /// <summary>
    /// Writes <paramref name="payload"/> through the host's serializer, which
    /// throws on a shape it cannot write, and hands it back. Wrapping a
    /// capture's result in this makes every test using it a serialisation test.
    /// </summary>
    public static T Checked<T>(T payload)
    {
        Write(payload);
        return payload;
    }

    /// <summary>The JSON the host writes for a topic's payload. Throws what the host throws.</summary>
    public static string Write(object? payload)
    {
        var sb = new StringBuilder();
        try
        {
            AppendValue.Invoke(null, new object?[] { sb, payload });
        }
        catch (TargetInvocationException e) when (e.InnerException != null)
        {
            throw e.InnerException;
        }
        return sb.ToString();
    }
}
