package com.sendspin.protocol
import okhttp3.OkHttpClient
import com.squareup.moshi.Moshi
import org.roomgoblin.display.AndroidPcmSendspinPlayer
class AudioFormat(c:String,n:Int,r:Int,b:Int)
class ClientPreferences(supportedFormats:List<AudioFormat>,artworkChannels:List<Any>,visualizerSupport:Any?,playerBufferCapacity:Int,playerSupportedCommands:List<String>,supportedOptionalRoles:Set<OptionalRole>)
interface ClientSettingsStore {fun getInt(key:String,default:Int):Int;fun putInt(key:String,value:Int);fun getString(key:String,default:String?):String?;fun putString(key:String,value:String)}
class JsonOptionalAdapterFactory
enum class OptionalRole {PLAYER}
enum class State {IDLE,CONNECTING,HANDSHAKING,CLOCK_SYNCING,STREAMING,ERROR,DISCONNECTED}
class Value<T>(var value:T)
class AudioBuffer {val size=0;val droppedChunks=0L;val lateChunks=0L}
class ClockSync
class SendSpinClient(okHttpClient:OkHttpClient,moshi:Moshi,preferences:ClientPreferences,val clientId:String,val clientName:String,manufacturer:String,productName:String,softwareVersion:String,audioPlayerFactory:(AudioBuffer,ClockSync)->AndroidPcmSendspinPlayer,settingsStore:ClientSettingsStore){
 companion object {val created=mutableListOf<SendSpinClient>();var failNextConnect=false}
 val state=Value(State.IDLE);val serverName=Value("");val audioPlayer:AndroidPcmSendspinPlayer?=null;val audioBuffer=AudioBuffer();var url="";var disconnected=false
 init{created.add(this)}
 fun connect(value:String){url=value;state.value=State.CLOCK_SYNCING;if(failNextConnect){failNextConnect=false;throw IllegalStateException("Synthetic partial connection failure")}}
 fun disconnect(reason:String){disconnected=true;state.value=State.DISCONNECTED}
}
