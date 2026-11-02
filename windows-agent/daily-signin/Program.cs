using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RoomGoblin.SignIn;

try
{
    if (args.Length == 1 && args[0] == "service")
    {
        var builder = Host.CreateApplicationBuilder(args);
        builder.Logging.ClearProviders(); // Never send sign-in material to telemetry/event logs.
        builder.Services.AddWindowsService(options => options.ServiceName = Installer.ServiceName);
        builder.Services.AddHostedService<SignInService>();
        await builder.Build().RunAsync();
        return 0;
    }
    return Installer.Run(args);
}
catch (Exception error)
{
    // Avoid exception messages containing account data, enrollment or secrets.
    Console.Error.WriteLine($"RoomGoblin sign-in operation failed ({error.GetType().Name}). Use the separate administrator account and the recovery instructions.");
    if (error is InvalidOperationException or InvalidDataException) Console.Error.WriteLine(error.Message);
    return 1;
}
