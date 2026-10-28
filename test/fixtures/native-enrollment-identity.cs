using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

/* INSTALL_FIXTURE */
internal sealed class ConfigFixture : IDisposable
{
    private readonly string dataRoot, mode;
    public readonly List<string[]> Calls = new();
    public const string Original = "synthetic-existing-identity";
    public ConfigFixture(string mode)
    {
        this.mode=mode;
        dataRoot=Path.Combine(AppContext.BaseDirectory,"owned-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dataRoot);
        if(mode=="existing")File.WriteAllText(Config,Original);
    }
    public string Config=>Path.Combine(dataRoot,"lab-agent.json");
    public string[] Files=>Directory.GetFiles(dataRoot);
    public void Run()=>WriteFreshEnrollmentConfig(Config,new Dictionary<string,string?> {
        ["--hub-url"]="https://fixture.invalid",["--agent-id"]="fixture-agent",
        ["--enrollment-token"]=new string('x',40)
    });
    private static class MachineDpapi
    {
        public static string ProtectString(string value)
        {
            if(value!=new string('x',40))throw new Exception("Enrollment token changed before protection");
            return "fixture-protected-token";
        }
    }
    private void RunProcess(string file,IEnumerable<string> arguments)
    {
        var args=arguments.ToArray();
        if(file!="icacls.exe")throw new Exception("Unexpected process in config fixture");
        Calls.Add(args);
        if(mode=="data-acl"&&args[0]==dataRoot||mode=="temp-acl"&&args[0].EndsWith(".tmp"))
            throw new InvalidOperationException("Fixture ACL rejection");
        if(mode=="race"&&args[0].EndsWith(".tmp"))File.WriteAllText(Config,Original);
    }
    public void Dispose()
    {
        if(Path.GetDirectoryName(dataRoot)!=AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar))
            throw new Exception("Unsafe config fixture cleanup");
        Directory.Delete(dataRoot,recursive:true);
    }
/* CONFIG_WRITER */
}
internal static class Program
{
    private static int Main()
    {
        var tests=new List<(string Name,Action Run)>{
            ("existing enrollment rejects fresh arguments before changes",()=>Existing(false,false)),
            ("existing enrollment rejects a one-use file before consumption",()=>Existing(true,false)),
            ("empty existing configuration fails closed",()=>Existing(false,true)),
            ("new enrollment still installs successfully",()=>Fresh(false)),
            ("new enrollment health failure still removes its own config",()=>Fresh(true)),
            ("writer refuses an existing configuration",()=>Write("existing")),
            ("writer preserves an identity published during preparation",()=>Write("race")),
            ("writer publishes protected fresh configuration",()=>Write("fresh")),
            ("data ACL failure publishes no configuration",()=>Write("data-acl")),
            ("temporary ACL failure cleans unpublished configuration",()=>Write("temp-acl"))
        };
        var failed=0;
        foreach(var test in tests) {
            try{test.Run();Console.WriteLine("PASS "+test.Name);}
            catch(Exception error){failed++;Console.Error.WriteLine("FAIL "+test.Name+": "+error.Message);}
        }
        Console.WriteLine($"Native enrollment identity tests: {tests.Count-failed} passed, {failed} failed, 0 skipped");
        return failed==0?0:1;
    }
    private static void Existing(bool file,bool empty)
    {
        using var fixture=new InstallFixture("health",true);
        fixture.SeedExistingIdentity(file,empty?"":ConfigFixture.Original);
        var previous=Console.Error;using var diagnostic=new StringWriter();
        try {
            Console.SetError(diagnostic);
            if(fixture.Run()!=12||fixture.Identity!=(empty?"":ConfigFixture.Original)||fixture.Calls.Count!=0||file&&!fixture.EnrollmentFileExists)
                throw new Exception("Fresh admission changed the existing identity or runtime");
            if(!diagnostic.ToString().Contains("without enrollment arguments"))
                throw new Exception("Admission failure did not explain the repair path");
        }finally{Console.SetError(previous);}
    }
    private static void Fresh(bool failure)
    {
        using var fixture=new InstallFixture(failure?"health":"success",true);
        var previous=Console.Error;var output=Console.Out;using var diagnostic=new StringWriter();
        try {
            Console.SetError(diagnostic);Console.SetOut(diagnostic);
            if(fixture.Run()!=(failure?20:0)||fixture.Identity!=(failure?null:"synthetic-fresh-identity"))
                throw new Exception("Fresh installation or its health-failure cleanup changed");
        }finally{Console.SetError(previous);Console.SetOut(output);}
    }
    private static void Write(string mode)
    {
        using var fixture=new ConfigFixture(mode);
        Exception? error=null;
        try{fixture.Run();}catch(Exception caught){error=caught;}
        if(mode=="existing"||mode=="race") {
            if(error is not IOException||File.ReadAllText(fixture.Config)!=ConfigFixture.Original)
                throw new Exception("Writer replaced an existing enrolled identity");
        }else if(mode.EndsWith("-acl")) {
            if(error is not InvalidOperationException||fixture.Files.Length!=0)
                throw new Exception("ACL failure retained unpublished enrollment material");
        }else {
            if(error is not null)throw error;
            using var json=JsonDocument.Parse(File.ReadAllText(fixture.Config));
            if(json.RootElement.GetProperty("enrollmentTokenProtected").GetString()!="fixture-protected-token"||
               json.RootElement.GetProperty("enrollmentToken").GetString()!=""||
               json.RootElement.GetProperty("agentId").GetString()!="fixture-agent")
                throw new Exception("Fresh writer lost identity or protection dispatch");
        }
        if(fixture.Files.Any(x=>x.EndsWith(".tmp")))throw new Exception("Staging file was not cleaned");
    }
}

