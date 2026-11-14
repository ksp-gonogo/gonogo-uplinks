using Gonogo.ScansatUplink;
using Xunit;

namespace GonogoScansatUplink.Tests
{
    public class CoverageHashTests
    {
        [Fact]
        public void SameGrid_HashesEqual()
        {
            var a = new short[360, 180];
            a[10, 20] = 5;
            var b = new short[360, 180];
            b[10, 20] = 5;

            Assert.Equal(CoverageHash.Hash(a), CoverageHash.Hash(b));
        }

        [Fact]
        public void DifferentGrid_HashesDiffer()
        {
            var a = new short[360, 180];
            var b = new short[360, 180];
            b[100, 50] = 1;

            Assert.NotEqual(CoverageHash.Hash(a), CoverageHash.Hash(b));
        }

        [Fact]
        public void HasChanged_NullLastHash_IsTrue()
        {
            var snapshot = new short[360, 180];
            Assert.True(CoverageHash.HasChanged(snapshot, null, out _));
        }

        [Fact]
        public void HasChanged_UnchangedSnapshot_IsFalse()
        {
            var snapshot = new short[360, 180];
            snapshot[1, 1] = 3;
            CoverageHash.HasChanged(snapshot, null, out ulong hash);

            Assert.False(CoverageHash.HasChanged(snapshot, hash, out _));
        }

        [Fact]
        public void HasChanged_DecreasedCoverage_IsTrue()
        {
            // Regression guard for the R7 headline: a decrease (reset /
            // quickload) must register as a change, not be missed because
            // it "only clears bits" - see scansat-migration-spec.md §0A.
            var before = new short[360, 180];
            before[5, 5] = 1;
            CoverageHash.HasChanged(before, null, out ulong hash);

            var after = new short[360, 180]; // bit cleared
            Assert.True(CoverageHash.HasChanged(after, hash, out _));
        }

        [Fact]
        public void AGridLaidOutInOneRowHashesAsTheGridDoes()
        {
            var random = new System.Random(7);
            var grid = new short[360, 180];
            for (var i = 0; i < 360; i++)
            {
                for (var j = 0; j < 180; j++)
                {
                    grid[i, j] = (short)random.Next(short.MinValue, short.MaxValue + 1);
                }
            }
            // Longer than the grid, as a row kept for reuse is after a larger grid has been through it.
            var cells = new short[grid.Length + 50];
            System.Buffer.BlockCopy(grid, 0, cells, 0, grid.Length * sizeof(short));

            Assert.Equal(CoverageHash.Hash(grid), CoverageHash.Hash(cells, grid.Length));
        }
    }
}
