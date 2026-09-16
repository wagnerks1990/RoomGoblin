using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RoomGoblin.Agent.Service;

if (args.Length >= 1 && args[0].Equals("--self-test", StringComparison.OrdinalIgnoreCase))
{
    var path = args.Length >= 2 ? args[1] : AgentPaths.DefaultConfigPath;
    return await SelfTest.RunAsync(path);
}

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "RoomGoblin Agent");
builder.Services.AddHostedService<AgentWorker>();

var host = builder.Build();
await host.RunAsync();
return 0;
