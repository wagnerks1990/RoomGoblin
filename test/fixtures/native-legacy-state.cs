using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;

/* INSTALL_FIXTURE */
[SupportedOSPlatform("windows")]
internal sealed class NativeCoreProbe
{
    public bool? Run() => ReadScheduledTaskEnabled("RoomGoblin-Codex-Read-Only-" + Guid.NewGuid().ToString("N"));
/* NATIVE_PROBE */
}
internal sealed class QueryFixture
{
    public Func<bool?> Read = () => true;
    public bool? Run() => ReadScheduledTaskEnabled("fixture-legacy");
    private bool? ReadScheduledTaskEnabledCore(string name)
    {
        if(name != "fixture-legacy") throw new Exception("Unexpected task identity");
        return Read();
    }
/* STATE_QUERY */
}
internal sealed class CoreFixture
{
    public static string Mode = "";
    public static readonly List<string> Released = new();
    public bool? Run(string mode) { Mode = mode; Released.Clear(); return ReadScheduledTaskEnabledCore("fixture-legacy"); }
    private static class Type
    {
        public static System.Type? GetTypeFromProgID(string name, bool throwOnError)
        {
            if(name != "Schedule.Service" || !throwOnError) throw new Exception("Unexpected COM identity");
            return Mode == "unavailable" ? null : typeof(FakeService);
        }
    }
    private static class Activator
    {
        public static object? CreateInstance(System.Type type) => Mode == "create" ? null : new FakeService();
    }
    private static class Marshal
    {
        public static bool IsComObject(object value) => true;
        public static int FinalReleaseComObject(object value) { Released.Add(value.GetType().Name); return 0; }
    }
/* STATE_CORE */
}
public sealed class FakeService
{
    public void Connect()
    {
        if(CoreFixture.Mode == "mapped-connect") throw new FileNotFoundException("Fixture mapped connection failure");
        if(CoreFixture.Mode == "connect") throw new COMException("Fixture connection failure", unchecked((int)0x80070002));
    }
    public object GetFolder(string name)
    {
        if(name != @"\") throw new Exception("Unexpected task folder");
        if(CoreFixture.Mode == "folder") throw new COMException("Fixture folder failure", unchecked((int)0x80070002));
        return new FakeFolder();
    }
}
public sealed class FakeFolder
{
    public object GetTask(string name)
    {
        if(name != "fixture-legacy") throw new Exception("Unexpected task name");
        if(CoreFixture.Mode == "mapped-missing") throw new FileNotFoundException("Fixture mapped missing task");
        if(CoreFixture.Mode == "missing") throw new COMException("Fixture missing task", unchecked((int)0x80070002));
        if(CoreFixture.Mode == "denied") throw new COMException("Fixture access denied", unchecked((int)0x80070005));
        return new FakeTask();
    }
}
public sealed class FakeTask
{
    public bool Enabled
    {
        get {
            if(CoreFixture.Mode == "mapped-enabled") throw new FileNotFoundException("Fixture mapped property failure");
            if(CoreFixture.Mode == "enabled-error") throw new COMException("Fixture enabled failure", unchecked((int)0x80070002));
            return CoreFixture.Mode != "disabled";
        }
    }
}
internal static class Program
{
    private static int Main()
    {
        var tests = new List<(string Name, Action Run)>();
        var skipped = 0;
        if(OperatingSystem.IsWindows()) tests.Add(("real COM missing-task read without registration",()=> {
            if(!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
            if(new NativeCoreProbe().Run() is not null) throw new Exception("Unique absent task unexpectedly exists");
        }));
        else skipped++;
        foreach(var state in new bool?[]{true,false,null})
        {
            tests.Add(("query preserves "+(state?.ToString()??"missing"), () => {
                var fixture=new QueryFixture { Read=()=>state };
                if(fixture.Run()!=state) throw new Exception("Task state changed");
            }));
            tests.Add(("failed install restores original state "+(state?.ToString()??"missing"),()=> InstallState(state,"health")));
        }
        tests.Add(("query errors retain their identity",()=> {
            var expected=new InvalidOperationException("fixture-query");
            var fixture=new QueryFixture { Read=()=>throw expected };
            try{fixture.Run();}catch(InvalidOperationException error)when(ReferenceEquals(error,expected)){return;}
            throw new Exception("Read failure was hidden");
        }));
        tests.Add(("query enforces real 30-second admission budget",QueryDeadline));
        foreach(var mode in new[]{"enabled","disabled","missing","mapped-missing","denied","connect","mapped-connect","folder","enabled-error","mapped-enabled","unavailable","create"})
            tests.Add(("COM task state: "+mode,()=>CoreState(mode)));
        tests.Add(("rejected disable preserves untouched native service",()=>InstallState(true,"disable-rejected")));
        tests.Add(("rejected disable preserves disabled legacy state",()=>InstallState(false,"disable-rejected")));
        tests.Add(("unknown task state prevents native mutation",()=>InstallState(true,"query")));
        var failures=0;
        foreach(var test in tests) {
            try{test.Run();Console.WriteLine("PASS "+test.Name);}
            catch(Exception error){failures++;Console.Error.WriteLine("FAIL "+test.Name+": "+error);}
        }
        Console.WriteLine($"Native legacy-state tests: {tests.Count-failures} passed, {failures} failed, {skipped} skipped");
        return failures==0?0:1;
    }
    private static void QueryDeadline()
    {
        using var release=new ManualResetEventSlim();
        using var completed=new ManualResetEventSlim();
        var fixture=new QueryFixture {Read=()=>{
            try{release.Wait();return false;}finally{completed.Set();}
        }};
        var elapsed=Stopwatch.StartNew();
        try {
            try{fixture.Run();throw new Exception("Stalled query was accepted");}
            catch(TimeoutException) {
                if(elapsed.Elapsed<TimeSpan.FromSeconds(29)||elapsed.Elapsed>TimeSpan.FromSeconds(35))
                    throw new Exception("Query did not use the real admission deadline");
            }
        } finally {
            release.Set();
            if(!completed.Wait(TimeSpan.FromSeconds(3))) throw new Exception("Owned fixture worker did not exit");
        }
    }
    private static void CoreState(string mode)
    {
        var fixture=new CoreFixture();
        bool? result=null; Exception? caught=null;
        try{result=fixture.Run(mode);}catch(Exception error){caught=error;}
        var expectedError=mode is "denied" or "connect" or "mapped-connect" or "folder" or "enabled-error" or "mapped-enabled" or "unavailable" or "create";
        if(expectedError!=(caught is not null))throw new Exception("Query failure was treated as missing state");
        if(!expectedError && result!=(mode is "missing" or "mapped-missing"?(bool?)null:mode!="disabled"))throw new Exception("Registered enabled state was not preserved");
        string[] expected=mode switch {
            "unavailable" or "create"=>Array.Empty<string>(),
            "connect" or "mapped-connect" or "folder"=>new[]{"FakeService"},
            "missing" or "mapped-missing" or "denied"=>new[]{"FakeFolder","FakeService"},
            _=>new[]{"FakeTask","FakeFolder","FakeService"}
        };
        if(!CoreFixture.Released.SequenceEqual(expected))throw new Exception("COM object ownership was not released");
    }
    private static void InstallState(bool? enabled,string mode)
    {
        using var fixture=new InstallFixture(mode,false,enabled);
        var originalError=Console.Error;
        using var diagnostic=new StringWriter();
        try {
            Console.SetError(diagnostic);
            if(fixture.Run()!=20)throw new Exception("Failure proceeded as successful installation");
            var restores=fixture.Calls.Count(x=>x.Contains("/Enable")||x.Contains("/Run"));
            var expectedRestore=enabled==true&&mode!="query"?2:0;
            if(restores!=expectedRestore)throw new Exception("Rollback changed the original legacy enabled state");
            var stops=fixture.Calls.Count(x=>x=="native-stop");
            if(stops!=(mode=="health"?2:0))throw new Exception("Failed legacy admission mutated the native service");
            if(!fixture.IdentitySafe||diagnostic.ToString().Length==0)throw new Exception("Identity or failure diagnostic was lost");
        } finally {Console.SetError(originalError);}
    }
}

