package org.roomgoblin.display;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

final class RootTools {
    private static final int MAX_OUTPUT_BYTES=64*1024;
    private static final long PROBE_TIMEOUT_SECONDS=5;
    private static final long COMMAND_TIMEOUT_SECONDS=15;
    private RootTools() {}

    private static final class Result {
        final int exitCode;
        final boolean timedOut;
        final String output;
        Result(int exitCode,boolean timedOut,String output){this.exitCode=exitCode;this.timedOut=timedOut;this.output=output;}
    }

    static boolean binaryDetected(){
        String[] paths={"/system/bin/su","/system/xbin/su","/sbin/su","/su/bin/su","/data/adb/magisk/busybox"};
        for(String p:paths)if(new File(p).exists())return true;
        return false;
    }

    static JSONObject probe(Context context) throws Exception {
        JSONObject o=new JSONObject();
        o.put("binaryDetected",binaryDetected());
        o.put("policyEnabled",HubStorage.prefs(context).getBoolean("allow_root_tools",false));
        try{
            Result result=execute("id",PROBE_TIMEOUT_SECONDS);
            boolean granted=!result.timedOut&&result.exitCode==0&&result.output.contains("uid=0");
            o.put("granted",granted);o.put("output",result.output);o.put("exitCode",result.exitCode);o.put("timedOut",result.timedOut);
        }catch(Exception e){o.put("granted",false);o.put("error",String.valueOf(e.getMessage()));}
        return o;
    }

    static JSONObject run(Context context,String command) throws Exception {
        SharedPreferences prefs=HubStorage.prefs(context);
        if(!prefs.getBoolean("allow_root_tools",false))throw new SecurityException("Root tools are disabled by RoomGoblin policy");
        if(command==null||command.trim().isEmpty()||command.length()>4096)throw new IllegalArgumentException("Invalid root command");
        Result result=execute(command,COMMAND_TIMEOUT_SECONDS);JSONObject o=new JSONObject();o.put("ok",!result.timedOut&&result.exitCode==0);o.put("exitCode",result.exitCode);o.put("timedOut",result.timedOut);o.put("output",result.output);return o;
    }

    private static Result execute(String command,long timeoutSeconds) throws Exception {
        final Process process=new ProcessBuilder("su","-c",command).redirectErrorStream(true).start();
        final ByteArrayOutputStream captured=new ByteArrayOutputStream();
        Thread drain=new Thread(()->{
            byte[] buffer=new byte[4096];
            try(InputStream input=process.getInputStream()){
                for(int count;(count=input.read(buffer))>=0;){
                    int remaining=MAX_OUTPUT_BYTES-captured.size();
                    if(remaining>0)captured.write(buffer,0,Math.min(remaining,count));
                }
            }catch(Exception ignored){}
        },"RoomGoblin-RootTools-Output");
        drain.setDaemon(true);drain.start();
        boolean finished=process.waitFor(timeoutSeconds,TimeUnit.SECONDS);
        if(!finished){process.destroy();if(!process.waitFor(500,TimeUnit.MILLISECONDS))process.destroyForcibly();}
        drain.join(1000);
        int exit=finished?process.exitValue():-1;
        return new Result(exit,!finished,new String(captured.toByteArray(),StandardCharsets.UTF_8));
    }
}
