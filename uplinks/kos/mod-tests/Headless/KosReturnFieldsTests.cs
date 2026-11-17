// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;
using System.Reflection;
using System.Runtime.CompilerServices;
using Gonogo.KosUplink;
using kOS.Safe.Encapsulation;
using kOS.Suffixed;
using UnityEngine;
using Xunit;

namespace GonogoKosUplink.Tests.Headless
{
    /// <summary>
    /// The value a script hands back, converted against the real kOS types.
    /// </summary>
    public class KosReturnFieldsTests
    {
        private static Lexicon One(string key, Structure value)
        {
            var lexicon = new Lexicon();
            lexicon.Add(new StringValue(key), value);
            return lexicon;
        }

        private static Dictionary<string, object?> Shape(object? value) => Assert.IsType<Dictionary<string, object?>>(value);

        private static T Field<T>(Dictionary<string, object?> shape, string name) => Assert.IsType<T>(shape[name]);

        /*
         * The constructors of Direction and GeoCoordinates call into the running
         * game (a native euler conversion, a shared-objects lookup), so these two
         * are built without one and given the managed state the converter reads.
         */
        private static Direction DirectionOf(Quaternion rotation)
        {
            var direction = (Direction)RuntimeHelpers.GetUninitializedObject(typeof(Direction));
            typeof(Direction).GetField("rotation", BindingFlags.NonPublic | BindingFlags.Instance)!
                .SetValue(direction, rotation);
            return direction;
        }

        private static GeoCoordinates GeoOf(double latitude, double longitude)
        {
            var geo = (GeoCoordinates)RuntimeHelpers.GetUninitializedObject(typeof(GeoCoordinates));
            typeof(GeoCoordinates).GetProperty("Latitude")!.SetValue(geo, latitude);
            typeof(GeoCoordinates).GetProperty("Longitude")!.SetValue(geo, longitude);
            return geo;
        }

        [Fact]
        public void Lexicon_KeepsNumbersBooleansAndStringsBare()
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
        public void List_ArrivesAsItsItemsInOrder()
        {
            var list = new ListValue();
            list.Add(ScalarValue.Create(1));
            list.Add(new StringValue("two"));

            var shape = Shape(KosReturnFields.From(One("items", list))["items"]);

            Assert.Equal(KosReturnShapes.KindList, shape["kind"]);
            var items = Field<List<object?>>(shape, "items");
            Assert.Equal(new object?[] { 1.0, "two" }, items);
            Assert.Equal(0, shape["omitted"]);
        }

        [Fact]
        public void NestedLexicon_ArrivesAsEntriesWithTheirKeyText()
        {
            var inner = new Lexicon();
            inner.Add(new StringValue("a"), ScalarValue.Create(1));
            inner.Add(ScalarValue.Create(2), BooleanValue.False);

            var shape = Shape(KosReturnFields.From(One("inner", inner))["inner"]);

            Assert.Equal(KosReturnShapes.KindLexicon, shape["kind"]);
            var entries = Field<List<object?>>(shape, "entries");
            Assert.Equal(2, entries.Count);
            var first = Shape(entries[0]);
            Assert.Equal("a", first["key"]);
            Assert.Equal(1.0, first["value"]);
            var second = Shape(entries[1]);
            Assert.Equal(ScalarValue.Create(2).ToString(), second["key"]);
            Assert.Equal(false, second["value"]);
        }

        [Fact]
        public void ListInsideLexiconInsideList_KeepsTheirStructure()
        {
            var leaf = new ListValue();
            leaf.Add(ScalarValue.Create(7));
            var middle = One("leaf", leaf);
            var outer = new ListValue();
            outer.Add(middle);

            var shape = Shape(KosReturnFields.From(One("outer", outer))["outer"]);

            var lexicon = Shape(Field<List<object?>>(shape, "items")[0]);
            Assert.Equal(KosReturnShapes.KindLexicon, lexicon["kind"]);
            var entry = Shape(Field<List<object?>>(lexicon, "entries")[0]);
            Assert.Equal(KosReturnShapes.KindList, Shape(entry["value"])["kind"]);
        }

        [Fact]
        public void UniqueSetQueueAndStack_ArriveAsListsNamedByType()
        {
            var set = new UniqueSetValue();
            set.Add(ScalarValue.Create(1));
            var queue = new QueueValue();
            queue.Push(ScalarValue.Create(2));
            var stack = new StackValue();
            stack.Push(ScalarValue.Create(3));
            var lexicon = new Lexicon();
            lexicon.Add(new StringValue("set"), set);
            lexicon.Add(new StringValue("queue"), queue);
            lexicon.Add(new StringValue("stack"), stack);

            var fields = KosReturnFields.From(lexicon);

            foreach (var name in new[] { "set", "queue", "stack" })
            {
                var shape = Shape(fields[name]);
                Assert.Equal(KosReturnShapes.KindList, shape["kind"]);
                Assert.Single(Field<List<object?>>(shape, "items"));
                Assert.False(string.IsNullOrEmpty(Field<string>(shape, "type")));
            }
        }

        [Fact]
        public void Vector_ArrivesWithItsComponentsAndMagnitude()
        {
            var shape = Shape(KosReturnFields.From(One("v", new Vector(3, 4, 12)))["v"]);

            Assert.Equal(KosReturnShapes.KindVector, shape["kind"]);
            Assert.Equal(3.0, shape["x"]);
            Assert.Equal(4.0, shape["y"]);
            Assert.Equal(12.0, shape["z"]);
            Assert.Equal(13.0, shape["magnitude"]);
        }

        [Theory]
        [InlineData(0, 0, 0, 0, 0, 0)]
        [InlineData(90, 0, 0, 90, 0, 0)]
        [InlineData(0, 90, 0, 0, 90, 0)]
        [InlineData(0, 0, 90, 0, 0, 90)]
        [InlineData(0, -90, 0, 0, 270, 0)]
        public void Direction_ArrivesAsPitchYawAndRollInDegrees(
            double axisX, double axisY, double axisZ, double pitch, double yaw, double roll)
        {
            var half = System.Math.PI / 4.0;
            var q = new Quaternion(
                (float)(System.Math.Sin(half) * (axisX != 0 ? System.Math.Sign(axisX) : 0)),
                (float)(System.Math.Sin(half) * (axisY != 0 ? System.Math.Sign(axisY) : 0)),
                (float)(System.Math.Sin(half) * (axisZ != 0 ? System.Math.Sign(axisZ) : 0)),
                axisX == 0 && axisY == 0 && axisZ == 0 ? 1f : (float)System.Math.Cos(half));

            var shape = Shape(KosReturnFields.From(One("d", DirectionOf(q)))["d"]);

            Assert.Equal(KosReturnShapes.KindDirection, shape["kind"]);
            Assert.Equal(pitch, Field<double>(shape, "pitch"), 3);
            Assert.Equal(yaw, Field<double>(shape, "yaw"), 3);
            Assert.Equal(roll, Field<double>(shape, "roll"), 3);
        }

        [Fact]
        public void TimeSpanAndTimeStamp_ArriveAsSecondsUnderTheirOwnKind()
        {
            var lexicon = new Lexicon();
            lexicon.Add(new StringValue("span"), new TimeSpan(125.5));
            lexicon.Add(new StringValue("stamp"), new TimeStamp(3600));

            var fields = KosReturnFields.From(lexicon);

            var span = Shape(fields["span"]);
            Assert.Equal(KosReturnShapes.KindTimeSpan, span["kind"]);
            Assert.Equal(125.5, span["seconds"]);
            var stamp = Shape(fields["stamp"]);
            Assert.Equal(KosReturnShapes.KindTimeStamp, stamp["kind"]);
            Assert.Equal(3600.0, stamp["seconds"]);
        }

        [Fact]
        public void GeoPosition_ArrivesAsLatitudeAndLongitude()
        {
            var shape = Shape(KosReturnFields.From(One("g", GeoOf(-0.0972, -74.5577)))["g"]);

            Assert.Equal(KosReturnShapes.KindGeo, shape["kind"]);
            Assert.Equal(-0.0972, shape["latitude"]);
            Assert.Equal(-74.5577, shape["longitude"]);
        }

        [Fact]
        public void APartOrVessel_ArrivesThroughTheReferenceReader()
        {
            var seen = new PIDLoop();
            KosReturnFields.ReferenceReader = value =>
                ReferenceEquals(value, seen) ? KosReturnShapes.Part("fuelTank", "42") : null;
            try
            {
                var shape = Shape(KosReturnFields.From(One("p", seen))["p"]);

                Assert.Equal(KosReturnShapes.KindPart, shape["kind"]);
                Assert.Equal("fuelTank", shape["name"]);
                Assert.Equal("42", shape["id"]);
            }
            finally
            {
                KosReturnFields.ReferenceReader = null;
            }
        }

        [Fact]
        public void AnyOtherValue_ArrivesAsItsTypeNameAndText()
        {
            var loop = new PIDLoop();

            var shape = Shape(KosReturnFields.From(One("pid", loop))["pid"]);

            Assert.Equal(KosReturnShapes.KindOther, shape["kind"]);
            Assert.Equal(loop.ToString(), shape["text"]);
            Assert.False(string.IsNullOrEmpty(Field<string>(shape, "type")));
        }

        [Fact]
        public void ANonLexiconValue_ArrivesUnderTheSingleFieldValue()
        {
            Assert.Equal(42.0, KosReturnFields.From(ScalarValue.Create(42))["value"]);
            Assert.Equal("hi", KosReturnFields.From(new StringValue("hi"))["value"]);

            var list = new ListValue();
            list.Add(ScalarValue.Create(1));
            var fields = KosReturnFields.From(list);

            Assert.Single(fields);
            Assert.Equal(KosReturnShapes.KindList, Shape(fields["value"])["kind"]);
        }

        [Fact]
        public void ALexiconThatHoldsItself_StopsAtTheDepthLimitAsText()
        {
            var lexicon = new Lexicon();
            lexicon.Add(new StringValue("self"), lexicon);

            var node = Shape(KosReturnFields.From(lexicon)["self"]);
            var depth = 1;
            while (node["kind"].Equals(KosReturnShapes.KindLexicon))
            {
                node = Shape(Shape(Field<List<object?>>(node, "entries")[0])["value"]);
                depth++;
            }

            Assert.Equal(KosReturnShapes.KindOther, node["kind"]);
            Assert.Equal(KosReturnFields.MaxDepth + 1, depth);
        }

        [Fact]
        public void ACollectionOverTheItemLimit_KeepsTheFirstItemsAndCountsTheRest()
        {
            var list = new ListValue();
            for (var i = 0; i < KosReturnFields.MaxItems + 3; i++)
            {
                list.Add(ScalarValue.Create(i));
            }

            var shape = Shape(KosReturnFields.From(One("big", list))["big"]);

            Assert.Equal(KosReturnFields.MaxItems, Field<List<object?>>(shape, "items").Count);
            Assert.Equal(3, shape["omitted"]);
        }
    }
}
