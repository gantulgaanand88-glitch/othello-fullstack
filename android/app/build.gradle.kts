plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.compose.compiler)
  alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.othello.arena"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.othello.arena"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            val apiUrl = providers.gradleProperty("OTHELLO_DEBUG_API_URL").orElse("http://10.0.2.2:4000/api").get()
            val socketUrl = providers.gradleProperty("OTHELLO_DEBUG_SOCKET_URL").orElse("http://10.0.2.2:4000").get()
            buildConfigField("String", "API_BASE_URL", "\"$apiUrl\"")
            buildConfigField("String", "SOCKET_URL", "\"$socketUrl\"")
        }
        release {
            val apiUrl = providers.gradleProperty("OTHELLO_API_URL").orElse("https://othello-api-cww8.onrender.com/api").get()
            val socketUrl = providers.gradleProperty("OTHELLO_SOCKET_URL").orElse("https://othello-api-cww8.onrender.com").get()
            buildConfigField("String", "API_BASE_URL", "\"$apiUrl\"")
            buildConfigField("String", "SOCKET_URL", "\"$socketUrl\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
      compose = true
      aidl = false
      buildConfig = true
      shaders = false
    }

    packaging {
      resources {
        excludes += "/META-INF/{AL2.0,LGPL2.1}"
      }
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
  val composeBom = platform(libs.androidx.compose.bom)
  implementation(composeBom)
  androidTestImplementation(composeBom)

  // Core Android dependencies
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.activity.compose)

  // Arch Components
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.datastore.preferences)

  // Compose
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)

  // Native networking and JSON. The Android platform provides org.json.
  implementation(libs.okhttp)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.socketio.client) {
    exclude(group = "org.json", module = "json")
  }
  // Tooling
  debugImplementation(libs.androidx.compose.ui.tooling)
  // Instrumented tests
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
  debugImplementation(libs.androidx.compose.ui.test.manifest)

  // Local tests: jUnit, coroutines, Android runner
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)

  // Instrumented tests: jUnit rules and runners
  androidTestImplementation(libs.androidx.test.core)
  androidTestImplementation(libs.androidx.test.ext.junit)
  androidTestImplementation(libs.androidx.test.runner)
  androidTestImplementation(libs.androidx.test.espresso.core)

  // Navigation
  implementation(libs.androidx.navigation3.ui)
  implementation(libs.androidx.navigation3.runtime)
  implementation(libs.androidx.lifecycle.viewmodel.navigation3)
}
