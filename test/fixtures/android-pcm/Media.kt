package android.media
import java.util.concurrent.*
class AudioManager
class AudioAttributes {class Builder {fun setUsage(v:Int)=this;fun setContentType(v:Int)=this;fun build()=AudioAttributes()};companion object {const val USAGE_MEDIA=1;const val CONTENT_TYPE_MUSIC=2}}
class AudioFormat {class Builder {fun setEncoding(v:Int)=this;fun setSampleRate(v:Int)=this;fun setChannelMask(v:Int)=this;fun build()=AudioFormat()};companion object {const val CHANNEL_OUT_STEREO=12;const val ENCODING_PCM_16BIT=2}}
class AudioTrack {
 companion object {const val PLAYSTATE_PLAYING=3;const val MODE_STREAM=1;const val WRITE_BLOCKING=0;val created=CopyOnWriteArrayList<AudioTrack>();var blockWrites=false;fun getMinBufferSize(a:Int,b:Int,c:Int)=16384}
 class Builder {fun setAudioAttributes(v:AudioAttributes)=this;fun setAudioFormat(v:AudioFormat)=this;fun setTransferMode(v:Int)=this;fun setBufferSizeInBytes(v:Int)=this;fun build()=AudioTrack().also{created.add(it)}}
 val writers=ConcurrentHashMap.newKeySet<Thread>();val entered=CountDownLatch(1);val gate=CountDownLatch(1);val block=blockWrites
 @Volatile var playState=0;var gain=1f;var released=false;var failPlay=false
 fun setVolume(v:Float){gain=v};fun play(){check(!failPlay){"Synthetic AudioTrack play failure"};playState=PLAYSTATE_PLAYING};fun pause(){playState=0};fun flush(){};fun stop(){playState=0};fun release(){released=true}
 fun write(data:ByteArray,offset:Int,size:Int,mode:Int):Int{writers.add(Thread.currentThread());entered.countDown();if(block){while(true){try{gate.await();break}catch(e:InterruptedException){}}};return size}
}
