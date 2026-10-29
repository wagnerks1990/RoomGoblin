#!/usr/bin/env python3
"""Run actual C# daily-code/enrollment/attempt logic without installing anything."""
from pathlib import Path
import subprocess
import tempfile
import html

root = Path(__file__).resolve().parents[1]
program = r'''
using System.Text;
using System.Text.Json;
using RoomGoblin.SignIn;
int checks=0;
void Check(bool ok) { if(!ok) throw new Exception("Sign-in contract failed at check " + (checks+1)); checks++; }
void Reject(Action action) { bool rejected=false; try { action(); } catch { rejected=true; } Check(rejected); }
using var fixture=JsonDocument.Parse(File.ReadAllText(args[0])); var f=fixture.RootElement;
var seed=Convert.FromBase64String(f.GetProperty("seed").GetString()!);var id=f.GetProperty("groupId").GetString()!;
foreach(var v in f.GetProperty("vectors").EnumerateArray()) {
  var day=Codes.Day("America/New_York",DateTimeOffset.Parse(v.GetProperty("now").GetString()!));
  Check(day==v.GetProperty("day").GetString());Check(Codes.ForDay(seed,id,day)==v.GetProperty("code").GetString());
}
var envelope=Encoding.UTF8.GetBytes(f.GetProperty("envelope").GetRawText());var pass=f.GetProperty("passphrase").GetString()!;
var now=DateTimeOffset.Parse("2026-10-29T15:00:00Z");
var policy=Codes.Decrypt(envelope,pass,now,"TEST-PC");Check(policy.Username=="esports");
Reject(()=>Codes.Decrypt(envelope,pass,now,"OTHER-PC"));
Reject(()=>Codes.Decrypt(envelope,"wrong passphrase long enough",now,"TEST-PC"));
Reject(()=>Codes.Decrypt(envelope,pass,now.AddDays(2),"TEST-PC"));
Reject(()=>Codes.Decrypt(envelope,pass,now.AddDays(-1),"TEST-PC"));
var invalid=Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(envelope).Replace("600000","1"));
Reject(()=>Codes.Decrypt(invalid,pass,now,"TEST-PC"));
var state=new Attempts {LatestUtc=now.ToUnixTimeSeconds()};var expected=Codes.ForDay(seed,id,Codes.Day(policy.TimeZone,now));
Check(state.Accept(expected,expected,now));
for(int i=0;i<5;i++)Check(!state.Accept("invalid!",expected,now));
// Restart cannot erase the persisted cooldown.
state=JsonSerializer.Deserialize<Attempts>(JsonSerializer.Serialize(state))!;
Check(!state.Accept(expected,expected,now.AddSeconds(30)));
Check(state.Accept(expected,expected,now.AddSeconds(61)));
Check(!state.Accept(expected,expected,now.AddHours(-1)));
var tomorrow=now.AddDays(1);var newCode=Codes.ForDay(seed,id,Codes.Day(policy.TimeZone,tomorrow));
Check(!state.Accept(expected,newCode,tomorrow));Check(state.Accept(newCode,newCode,tomorrow));
Check(!state.Accept("",newCode,tomorrow));Check(!state.Accept("123456789",newCode,tomorrow));
Console.WriteLine($"Daily sign-in C# contracts: {checks} passed, 0 failed, 0 skipped. No Windows accounts, services or providers changed.");
'''
with tempfile.TemporaryDirectory(prefix="roomgoblin-signin-test-") as directory:
    work = Path(directory)
    (work / "fixture.json").write_bytes(subprocess.check_output(["node", str(root / "tools/daily-signin-fixtures.js")], cwd=root))
    source = html.escape(str(root / "windows-agent/daily-signin/Core.cs"), quote=True)
    (work / "Test.csproj").write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><RollForward>Major</RollForward><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup><ItemGroup><Compile Include="{source}" Link="Core.cs" /></ItemGroup></Project>', encoding="utf-8")
    (work / "Program.cs").write_text(program, encoding="utf-8")
    subprocess.run(["dotnet", "run", "--project", str(work / "Test.csproj"), "-c", "Release", "--", str(work / "fixture.json")], cwd=root, check=True)
