import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

public class AndroidSocketLifecycleTest {
    static class ServiceStub { public void onDestroy() {} }
    static class Log { static void i(String tag,String text) {} static void e(String tag,String text,Exception error) {} }
    static class NativeSendspinManager { static final NativeSendspinManager INSTANCE=new NativeSendspinManager(); void stop(String reason) {} }
    static class KioskWatchdog { static void stop() {} }
    static class Harness extends ServiceStub implements AutoCloseable {
/* SERVICE_FIELDS */
        final List<Socket> peers=new ArrayList<>();
        final AtomicInteger handlers=new AtomicInteger();
        Harness() throws Exception {
            bind();
        }
        void bind() throws Exception {
            synchronized(listenerLock){
            closeListenerLocked();
            ServerSocket owned=new ServerSocket(0,16,InetAddress.getLoopbackAddress());
            server=owned;boundPort=owned.getLocalPort();
            listenerThread=new Thread(()->listen(owned,boundPort));listenerThread.setDaemon(true);listenerThread.start();
            }
        }
        Socket connect() throws Exception {
            Socket peer=new Socket(InetAddress.getLoopbackAddress(),boundPort);peer.setSoTimeout(500);peers.add(peer);return peer;
        }
        void fill() throws Exception {
            for(int i=0;i<MAX_CLIENT_WORKERS+MAX_QUEUED_CLIENTS;i++)connect();
            await(()->((ThreadPoolExecutor)workers).getActiveCount()==MAX_CLIENT_WORKERS&&((ThreadPoolExecutor)workers).getQueue().size()==MAX_QUEUED_CLIENTS);
        }
        // Listener, pool, admission and shutdown are actual source. The handler
        // deliberately blocks in a real socket read, without Android APIs.
        private void handle(Socket socket) {
            handlers.incrementAndGet();
            try(Socket s=socket){while(s.getInputStream().read()!=-1){}}
            catch(IOException expected){}
        }
/* SERVICE_DESTROY */
/* SERVICE_LISTENER */
        public void close() throws Exception {
            onDestroy();for(Socket peer:peers)try{peer.close();}catch(IOException ignored){}
            workers.awaitTermination(2,TimeUnit.SECONDS);
        }
    }
    static void await(BooleanSupplier condition) throws Exception {
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);
        while(!condition.getAsBoolean()){if(System.nanoTime()>=end)throw new AssertionError("Socket fixture did not reach its bounded ready state");Thread.sleep(5);}
    }
    static boolean closed(Socket peer) throws Exception {
        try{return peer.getInputStream().read()==-1;}
        catch(SocketTimeoutException open){return false;}
        catch(SocketException reset){return true;}
    }
    static void shutdownClosesEveryAcceptedClient() throws Exception {
        try(Harness h=new Harness()){
            h.fill();h.onDestroy();
            for(Socket peer:h.peers)if(!closed(peer))throw new AssertionError("Service destruction left an active or queued client open");
            if(!h.workers.awaitTermination(1,TimeUnit.SECONDS))throw new AssertionError("Socket workers did not terminate");
        }
    }
    static void saturatedAdmissionClosesOnlyTheExcessClient() throws Exception {
        try(Harness h=new Harness()){
            h.fill();Socket excess=h.connect();
            if(!closed(excess))throw new AssertionError("Excess socket was retained beyond the bounded queue");
            if(closed(h.peers.get(0)))throw new AssertionError("Admission rejection closed an admitted reader");
        }
    }
    static void normalHandlerCompletionClosesItsClient() throws Exception {
        try(Harness h=new Harness()){
            Socket peer=h.connect();peer.shutdownOutput();
            if(!closed(peer))throw new AssertionError("Finished handler retained its client");
            await(()->h.handlers.get()==1);h.onDestroy();
            if(!h.workers.awaitTermination(1,TimeUnit.SECONDS))throw new AssertionError("Finished worker did not terminate");
        }
    }
    static void listenerReplacementRetainsAcceptedClientsAndNewListener() throws Exception {
        try(Harness h=new Harness()){
            Socket old=h.connect();await(()->h.handlers.get()==1);h.bind();
            Socket current=h.connect();await(()->h.handlers.get()==2);
            if(closed(old)||closed(current))throw new AssertionError("Listener replacement cancelled an accepted client");
            h.onDestroy();
            if(!closed(old)||!closed(current))throw new AssertionError("Replacement left a client behind at service shutdown");
        }
    }
    interface Case { void run() throws Exception; }
    public static void main(String[] args) throws Exception {
        String[] names={"shutdown closes active and queued clients","saturated admission closes only the excess client","completed handlers close their clients","listener replacement preserves accepted clients and current listener"};
        Case[] cases={AndroidSocketLifecycleTest::shutdownClosesEveryAcceptedClient,AndroidSocketLifecycleTest::saturatedAdmissionClosesOnlyTheExcessClient,AndroidSocketLifecycleTest::normalHandlerCompletionClosesItsClient,AndroidSocketLifecycleTest::listenerReplacementRetainsAcceptedClientsAndNewListener};
        int failed=0;
        for(int i=0;i<cases.length;i++)try{cases[i].run();System.out.println("PASS "+names[i]);}catch(Throwable failure){failed++;System.err.println("FAIL "+names[i]+": "+failure.getMessage());}
        System.out.println("Android socket lifecycle: "+(cases.length-failed)+" passed, "+failed+" failed, 0 skipped");
        if(failed!=0)System.exit(1);
    }
}
