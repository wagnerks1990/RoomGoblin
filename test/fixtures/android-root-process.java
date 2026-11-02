import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.*;

public class AndroidRootProcessTest {
/* ROOT_FIELDS */
    static volatile Process child;
    static volatile Throwable thrown;
    static volatile CountDownLatch spawned;

    // Substitute only privileged process creation. All waiting, draining,
    // interruption and cleanup below come from RootTools. The child is a local
    // Java fixture; no su executable or Android command is run.
    static class ProcessBuilder {
        final String[] args;
        ProcessBuilder(String... values){args=values;}
        ProcessBuilder redirectErrorStream(boolean value){return this;}
        Process start() throws Exception {
            if(!args[0].equals("su")||!args[1].equals("-c"))throw new AssertionError("Unexpected command shape");
            child=new java.lang.ProcessBuilder(System.getProperty("java.home")+"/bin/java","-cp",System.getProperty("java.class.path"),"AndroidRootProcessTest","child",args[2]).redirectErrorStream(true).start();
            if(spawned!=null)spawned.countDown();
            return child;
        }
    }
/* ROOT_RESULT */
/* ROOT_EXECUTE */
    static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    static void terminateFixture() throws Exception {
        if(child!=null){child.destroyForcibly();child.waitFor(2,TimeUnit.SECONDS);}
        child=null;spawned=null;
    }
    static void normalCompletion() throws Exception {
        Result result=execute("normal",3);
        check(result.exitCode==0&&!result.timedOut&&result.output.contains("fixture-output"),"Normal child result changed");
        check(!child.isAlive(),"Completed child retained");
    }
    static void nonzeroCompletion() throws Exception {
        Result result=execute("failure",3);
        check(result.exitCode==7&&!result.timedOut,"Nonzero child exit was lost");
    }
    static void boundedOutput() throws Exception {
        Result result=execute("flood",3);
        check(result.exitCode==0&&!result.timedOut&&result.output.length()==64*1024,"Output was not drained and capped at 64 KiB");
    }
    static void timeout() throws Exception {
        Result result=execute("sleep",1);
        check(result.timedOut&&result.exitCode==-1&&!child.isAlive(),"Timed out child was not terminated");
    }
    static void interruption() throws Exception {
        thrown=null;spawned=new CountDownLatch(1);
        Thread worker=new Thread(()->{try{execute("sleep",15);}catch(Throwable error){thrown=error;}});
        worker.setDaemon(true);worker.start();
        check(spawned.await(3,TimeUnit.SECONDS),"Fixture process did not start");
        worker.interrupt();worker.join(2000);
        check(!worker.isAlive(),"Interrupted operation did not return");
        check(thrown instanceof InterruptedException,"Interruption was not propagated");
        check(!child.isAlive(),"Interrupted operation left its child alive");
    }
    interface Case {void run() throws Exception;}
    public static void main(String[] args) throws Exception {
        if(args.length>0){
            switch(args[1]){
                case "normal":System.out.println("fixture-output");return;
                case "failure":System.exit(7);return;
                case "flood":byte[] bytes=new byte[200000];Arrays.fill(bytes,(byte)'x');System.out.write(bytes);System.out.flush();return;
                default:Thread.sleep(60000);return;
            }
        }
        String[] names={"normal completion","nonzero exit","bounded output drain","timeout terminates child","interruption terminates child"};
        Case[] cases={AndroidRootProcessTest::normalCompletion,AndroidRootProcessTest::nonzeroCompletion,AndroidRootProcessTest::boundedOutput,AndroidRootProcessTest::timeout,AndroidRootProcessTest::interruption};
        int failed=0;
        for(int i=0;i<cases.length;i++)try{cases[i].run();System.out.println("PASS "+names[i]);}catch(Throwable error){failed++;System.err.println("FAIL "+names[i]+": "+error.getMessage());}finally{terminateFixture();}
        System.out.println("Android root process: "+(cases.length-failed)+" passed, "+failed+" failed, 0 skipped");
        if(failed!=0)System.exit(1);
    }
}
