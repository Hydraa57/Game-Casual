package com.pixelmatrix

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Kembalikan tema aplikasi sebelum React Native mulai menggambar.
   *
   * Activity ini dideklarasikan dengan `SplashTheme` di manifest, karena Android
   * menggambar `windowBackground` tema activity SEBELUM satu baris pun kode
   * aplikasi jalan — itu satu-satunya cara mengganti layar putih bawaan sistem.
   *
   * Tapi tema itu tidak boleh tertinggal: latar splash-nya akan terus terpasang
   * di belakang seluruh aplikasi, dan setiap layar yang punya bagian tembus
   * pandang akan memperlihatkan ikon peluncur di baliknya. `setTheme` di sini
   * menukarnya kembali, dan harus dipanggil SEBELUM `super.onCreate` supaya
   * React Native memulai dengan tema yang benar.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(savedInstanceState)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "PixelMatrix"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
