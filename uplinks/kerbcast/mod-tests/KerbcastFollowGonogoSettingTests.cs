using System.Collections.Generic;
using System.IO;
using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

public sealed class KerbcastFollowGonogoSettingTests : System.IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "kerbcast-follow-" + System.Guid.NewGuid().ToString("N"));
    private readonly List<string> _warnings = new();

    private string ShippedPath => Path.Combine(_dir, "settings.cfg");

    private string OverridePath => Path.Combine(_dir, "PluginData", "settings.cfg");

    public void Dispose()
    {
        if (Directory.Exists(_dir))
        {
            Directory.Delete(_dir, true);
        }
    }

    private static void Write(string path, string text)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, text);
    }

    private KerbcastBindAddress Address() => new(ShippedPath, OverridePath);

    private RecordingUplinkSettings Declared(string? stored = null)
    {
        var settings = new RecordingUplinkSettings(
            stored == null ? null : new Dictionary<string, string> { [KerbcastFollowGonogoSetting.Name] = stored });
        new KerbcastFollowGonogoSetting(Address(), _warnings.Add).Declare(settings);
        settings.Close();
        return settings;
    }

    [Fact]
    public void TheRowIsABoolOffByDefaultAndRecommendedInTheSetup()
    {
        var row = Assert.Single(Declared().Declared);

        Assert.Equal(KerbcastFollowGonogoSetting.Name, row.Name);
        Assert.Equal(SettingKind.Bool, row.Kind);
        Assert.Equal("False", row.DefaultText);
        Assert.Equal(new[] { SettingTags.Setup }, row.Tags);
    }

    [Fact]
    public void TurningItOnListensOnEveryAddressAndOffGoesBackToThisComputer()
    {
        Write(OverridePath, "Settings\n{\n  BindAddress = 127.0.0.1 // only here\n  Port = 8088\n}\n");
        var settings = Declared();

        settings.Change(KerbcastFollowGonogoSetting.Name, "True");

        var on = File.ReadAllText(OverridePath);
        Assert.Contains("BindAddress = 0.0.0.0 // only here", on);
        Assert.Contains("Port = 8088", on);

        settings.Change(KerbcastFollowGonogoSetting.Name, "False");

        Assert.Contains("BindAddress = 127.0.0.1 // only here", File.ReadAllText(OverridePath));
        Assert.Empty(_warnings);
    }

    [Fact]
    public void TheOverrideIsCreatedOrGainsTheLineAndTheShippedFileIsNeverWritten()
    {
        Write(ShippedPath, "Settings\n{\n  BindAddress = 127.0.0.1\n}\n");
        var address = Address();

        Assert.Equal(string.Empty, address.Apply(true));
        Assert.Contains("BindAddress = 0.0.0.0", File.ReadAllText(OverridePath));
        Assert.Equal("Settings\n{\n  BindAddress = 127.0.0.1\n}\n", File.ReadAllText(ShippedPath));

        Write(OverridePath, "Settings\n{\n  Port = 9000\n}\n");
        Assert.Equal(string.Empty, address.Apply(true));

        var text = File.ReadAllText(OverridePath);
        Assert.Contains("BindAddress = 0.0.0.0", text);
        Assert.Contains("Port = 9000", text);
    }

    [Fact]
    public void TheSettingIsReadFromKerbcastsFilesWithTheOverrideWinning()
    {
        Write(ShippedPath, "Settings\n{\n  BindAddress = 0.0.0.0\n}\n");
        Assert.Equal("True", Declared().Text(KerbcastFollowGonogoSetting.Name));

        Write(OverridePath, "Settings\n{\n  BindAddress = 127.0.0.1\n}\n");
        Assert.Equal("False", Declared().Text(KerbcastFollowGonogoSetting.Name));
    }

    [Theory]
    [InlineData("192.168.1.20", "True")]
    [InlineData("0.0.0.0", "False")]
    public void StartUpWritesNothingAndTheSettingTakesKerbcastsAddress(string address, string lastSaved)
    {
        var text = "Settings\n{\n  BindAddress = " + address + "\n}\n";
        Write(OverridePath, text);

        var settings = Declared(lastSaved);

        Assert.Equal(address == KerbcastBindAddress.EveryAddress ? "True" : "False", settings.Text(KerbcastFollowGonogoSetting.Name));
        Assert.Equal(text, File.ReadAllText(OverridePath));
        Assert.Empty(_warnings);
    }

    [Fact]
    public void AnOverrideThatCannotBeWrittenIsReportedNotThrown()
    {
        Directory.CreateDirectory(OverridePath);
        var settings = Declared();

        settings.Change(KerbcastFollowGonogoSetting.Name, "True");

        Assert.NotEmpty(_warnings);
    }
}
