#!/bin/sh
# 打包可以直接装到安卓手机上的安装包。这是 release 版，用调试签名，只适合自己安装，不能上架。
#
# 第一次运行前：
#   1. 运行 scripts/setup-android.sh 准备 JDK 和安卓命令行工具
#   2. 阅读并同意安卓 SDK 的许可协议：
#      ~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager --licenses
#      （需要的 SDK、NDK 等组件，会在第一次打包时自动下载）
set -eu
cd "$(dirname "$0")/.."

export JAVA_HOME="$HOME/Library/Android/jdk-17"
export ANDROID_HOME="$HOME/Library/Android/sdk"
# 这里的网络会打断 Java 的 TLS 1.3 握手（dl.google.com 几乎每次失败，Maven Central 时好时坏），
# 只用 TLS 1.2 就都正常。打包期间所有 Java 进程（包括 Gradle 守护进程）都用这个设置。
export JAVA_TOOL_OPTIONS="-Djdk.tls.client.protocols=TLSv1.2"

# 先装好编译要用的 SDK 组件。交给安卓插件在后台自动下载时，网络一卡就会无声无息地卡几个小时。
# 版本跟着 React Native 的配置走；CMake 用安卓插件的默认版本。
RN_VERSIONS=node_modules/react-native/gradle/libs.versions.toml
version_of() { sed -n "s/^$1 = \"\(.*\)\"/\1/p" "$RN_VERSIONS"; }
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --install \
  "build-tools;$(version_of buildTools)" "ndk;$(version_of ndkVersion)" "cmake;3.22.1"

npx expo prebuild --platform android --no-install
cd android
# 停掉之前没带这个设置启动的 Gradle 守护进程，否则会被复用
./gradlew --stop
# 只打 arm64：现在的安卓手机基本都是这个架构，安装包能小很多。
# 依赖优先走国内镜像，并在网络中断时多重试几次。
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a \
  --init-script ../scripts/gradle-mirrors.gradle \
  -Dorg.gradle.internal.repository.max.retries=6 \
  -Dorg.gradle.internal.repository.initial.backoff=1000
cd ..
cp android/app/build/outputs/apk/release/app-release.apk Gradatim.apk

# 有正式签名文件夹（默认是项目旁边的 gradatim-signing，里面有 说明.txt）时，换成正式签名。
# 用安卓的签名轮换：安卓 9 以上的手机上，之前用调试签名装的版本可以直接覆盖升级，记录不会丢。
SIGNING_DIR="${GRADATIM_SIGNING_DIR:-../gradatim-signing}"
if [ -f "$SIGNING_DIR/release.jks" ]; then
  "$ANDROID_HOME/build-tools/$(version_of buildTools)/apksigner" sign \
    --ks "$SIGNING_DIR/debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android \
    --next-signer --ks "$SIGNING_DIR/release.jks" --ks-key-alias gradatim --ks-pass "file:$SIGNING_DIR/password.txt" \
    --lineage "$SIGNING_DIR/debug-to-release.lineage" --rotation-min-sdk-version 28 \
    --v4-signing-enabled false \
    Gradatim.apk
  echo "已换成正式签名"
else
  echo "没找到 $SIGNING_DIR/release.jks，用的是调试签名，只适合装在自己手机上"
fi
echo "安装包：$(pwd)/Gradatim.apk"
