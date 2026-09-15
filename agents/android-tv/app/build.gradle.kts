plugins {
    id("com.android.application")
}

android {
    namespace = "org.roomgoblin.display"
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }
    buildFeatures {
        buildConfig = true
    }
    defaultConfig {
        applicationId = "org.roomgoblin.display"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.3.1-agent-v2"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes { release { isMinifyEnabled = false } }
}

dependencies {
    implementation("com.github.MuntashirAkon:libadb-android:3.1.1")
    implementation("org.conscrypt:conscrypt-android:2.7.0")
    implementation("com.github.Sendspin:sendspin-jvm:v0.3.4")
    implementation("com.squareup.moshi:moshi:1.15.2")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.2")
    implementation("com.squareup.okhttp3:okhttp:5.5.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
