using System.Collections.Generic;
using System.Reflection;
using System.Reflection.Emit;
using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// <see cref="KosRuntimeSubclass"/> against a base class shaped like kOS's
    /// <c>Addon</c>: one constructor argument, a protected method that registers
    /// named members, and an abstract method with no arguments.
    /// </summary>
    public class KosRuntimeSubclassTests
    {
        public interface IFakeMember
        {
        }

        public sealed class FakeMember : IFakeMember
        {
            public FakeMember(object owner) => Owner = owner;

            public object Owner { get; }
        }

        [System.AttributeUsage(System.AttributeTargets.Class)]
        public sealed class FakeNameAttribute : System.Attribute
        {
            public FakeNameAttribute(string name) => Name = name;

            public string Name { get; }
        }

        public abstract class FakeBase
        {
            protected FakeBase(string shared) => Shared = shared;

            public string Shared { get; }

            public Dictionary<string, IFakeMember> Members { get; } = new Dictionary<string, IFakeMember>();

            protected void AddMember(string name, IFakeMember member) => Members[name] = member;

            public abstract string Available();
        }

        public static object MemberFor(object shared) => new FakeMember(shared);

        public static object AvailableValue() => "yes";

        private static System.Type Build() =>
            KosRuntimeSubclass.Build(
                typeof(FakeBase),
                typeof(string),
                typeof(FakeBase).GetMethod("AddMember", BindingFlags.Instance | BindingFlags.NonPublic)!,
                new[] { new KeyValuePair<string, MethodInfo>("RETURN", typeof(KosRuntimeSubclassTests).GetMethod(nameof(MemberFor))!) },
                new[] { new KeyValuePair<MethodInfo, MethodInfo>(typeof(FakeBase).GetMethod(nameof(FakeBase.Available))!, typeof(KosRuntimeSubclassTests).GetMethod(nameof(AvailableValue))!) },
                new[] { new CustomAttributeBuilder(typeof(FakeNameAttribute).GetConstructor(new[] { typeof(string) })!, new object[] { "GonogoAddon" }) });

        [Fact]
        public void TheSubclassPassesItsArgumentOnAndRegistersEachMember()
        {
            var instance = (FakeBase)System.Activator.CreateInstance(Build(), "cpu-7")!;

            Assert.Equal("cpu-7", instance.Shared);
            var member = Assert.IsType<FakeMember>(instance.Members["RETURN"]);
            Assert.Equal("cpu-7", member.Owner);
        }

        [Fact]
        public void TheOverrideReturnsTheHooksValue()
        {
            var instance = (FakeBase)System.Activator.CreateInstance(Build(), "cpu-7")!;

            Assert.Equal("yes", instance.Available());
        }

        [Fact]
        public void TheSubclassCarriesTheAttributesAndLivesOutsideThePlugin()
        {
            var type = Build();

            Assert.Equal("GonogoAddon", type.GetCustomAttribute<FakeNameAttribute>()!.Name);
            Assert.True(type.Assembly.IsDynamic);
            Assert.NotEqual(typeof(KosRuntimeSubclass).Assembly, type.Assembly);
        }
    }
}
