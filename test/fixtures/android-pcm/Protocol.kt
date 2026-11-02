package com.sendspin.protocol
import java.util.concurrent.ConcurrentLinkedQueue
class ClockSync
class StreamFormat(val codec:String="pcm",val sampleRate:Int=48000,val channels:Int=2,val bitDepth:Int=16)
class Chunk(val data:ByteArray=ByteArray(4))
class AudioBuffer {val chunks=ConcurrentLinkedQueue<Chunk>();fun poll()=chunks.poll();fun nextChunkDelayMicros():Long?=5000L;fun flush(){chunks.clear()};fun add(){chunks.add(Chunk())}}
interface AudioPlayer {val isPlaying:Boolean;val droppedDecodeFrames:Long;fun configure(format:StreamFormat);fun start();fun flush();fun stop();fun transition(format:StreamFormat);fun setVolume(gain:Float)}
