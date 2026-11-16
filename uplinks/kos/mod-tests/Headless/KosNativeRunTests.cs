// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using Gonogo.KosUplink;
using kOS.Safe.Encapsulation;
using kOS.Safe.Exceptions;
using Xunit;

namespace GonogoKosUplink.Tests.Headless
{
    /// <summary>
    /// The lexicon a script hands back, converted against the real kOS types.
    /// </summary>
    public class KosNativeRunTests
    {
        [Fact]
        public void ReturnFields_KeepNumbersBooleansAndStrings()
        {
            var lexicon = new Lexicon();
            lexicon.Add(new StringValue("dv"), ScalarValue.Create(1234.5));
            lexicon.Add(new StringValue("stages"), ScalarValue.Create(4));
            lexicon.Add(new StringValue("ok"), BooleanValue.True);
            lexicon.Add(new StringValue("name"), new StringValue("Kerbal X"));

            var fields = KosReturnFields.From(lexicon);

            Assert.Equal(1234.5, fields["dv"]);
            Assert.Equal(4.0, fields["stages"]);
            Assert.Equal(true, fields["ok"]);
            Assert.Equal("Kerbal X", fields["name"]);
        }

        [Fact]
        public void ReturnFields_AnyOtherValueArrivesAsItsText()
        {
            var list = new ListValue();
            list.Add(ScalarValue.Create(1));
            var lexicon = new Lexicon();
            lexicon.Add(new StringValue("items"), list);

            var fields = KosReturnFields.From(lexicon);

            Assert.Equal(list.ToString(), fields["items"]);
        }

        [Fact]
        public void ReturnFields_ANonLexiconIsAKosError()
        {
            var error = Assert.Throws<KOSException>(() => KosReturnFields.From(ScalarValue.Create(1)));

            Assert.Contains("LEXICON", error.Message);
        }
    }
}
