package com.toust.tositochest.ui.util

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.toust.tositochest.R

object SoundManager {
    private var soundPool: SoundPool? = null
    private var moveSoundId: Int = 0
    private var captureSoundId: Int = 0
    private var checkSoundId: Int = 0
    private var notifySoundId: Int = 0
    private var isLoaded = false

    fun init(context: Context) {
        if (isLoaded) return

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(5)
            .setAudioAttributes(audioAttributes)
            .build()

        soundPool?.let { pool ->
            // These will fail gracefully if resources are not found yet
            moveSoundId = pool.load(context, R.raw.move, 1)
            captureSoundId = pool.load(context, R.raw.capture, 1)
            checkSoundId = pool.load(context, R.raw.check, 1)
            notifySoundId = pool.load(context, R.raw.notify, 1)
            isLoaded = true
        }
    }

    fun playMove() = play(moveSoundId)
    fun playCapture() = play(captureSoundId)
    fun playCheck() = play(checkSoundId)
    fun playNotify() = play(notifySoundId)

    private fun play(soundId: Int) {
        if (soundId != 0) {
            soundPool?.play(soundId, 1f, 1f, 1, 0, 1f)
        }
    }

    fun release() {
        soundPool?.release()
        soundPool = null
        isLoaded = false
    }
}
