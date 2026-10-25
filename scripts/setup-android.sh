#!/bin/sh
# 准备本机的安卓编译环境：JDK 17 和安卓命令行工具都放在 ~/Library/Android 里，
# 不需要管理员密码，也不改动系统里已经装好的软件。
# 安卓 SDK 的许可协议需要你自己确认，见 scripts/build-android.sh 的说明。
set -eu

ANDROID_DIR="$HOME/Library/Android"
JDK_DIR="$ANDROID_DIR/jdk-17"
SDK_DIR="$ANDROID_DIR/sdk"

case "$(uname -m)" in
  arm64) JDK_ARCH=aarch64; TOOLS_ARCH=mac_arm64 ;;
  *) JDK_ARCH=x64; TOOLS_ARCH=mac ;;
esac
JDK_URL="https://api.adoptium.net/v3/binary/latest/17/ga/mac/$JDK_ARCH/jdk/hotspot/normal/eclipse"
TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-$TOOLS_ARCH-15859902_latest.zip"

mkdir -p "$SDK_DIR/cmdline-tools"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if [ ! -x "$JDK_DIR/bin/java" ]; then
  echo "下载 JDK 17…"
  curl -fL --progress-bar -o "$TMP/jdk.tar.gz" "$JDK_URL"
  tar -xzf "$TMP/jdk.tar.gz" -C "$TMP"
  mkdir -p "$JDK_DIR"
  cp -R "$TMP"/jdk-17*/Contents/Home/. "$JDK_DIR/"
fi

if [ ! -x "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "下载安卓命令行工具…"
  curl -fL --progress-bar -o "$TMP/tools.zip" "$TOOLS_URL"
  unzip -q "$TMP/tools.zip" -d "$TMP/tools"
  rm -rf "$SDK_DIR/cmdline-tools/latest"
  mv "$TMP/tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
fi

"$JDK_DIR/bin/java" -version
echo "准备好了：JAVA_HOME=$JDK_DIR  ANDROID_HOME=$SDK_DIR"
