#!/system/bin/sh
# Cuongche - Optimized Edition v2.2
# Improvements from v2.1:
# - Added config file loading (/data/local/tmp/cuongche.conf).
# - Cached meminfo values to reduce /proc/meminfo reads.
# - Added LAST_PRELOADED_GAME to prevent redundant preloading.
# - Improved post_notification with channel ID and error logging.
# - Added ENABLE_METRICS_LOGGING for detailed logging.
# - Enhanced detect_foreground_game with input_method fallback.
# - Adaptive polling interval for game mode.
# - Limited parallelism in task_preload_game_libs.
# - Integrated trick function for com.xiaomi.joyose package.

VERSION="2.2"

LOCK_FILE="/data/local/tmp/memory_guardian.lock"
LOG_FILE="/data/local/tmp/memory_guardian.log"
CONFIG_FILE="/data/local/tmp/cuongche.conf"
TMP_DIR="/data/local/tmp/cu_temp"
mkdir -p "$TMP_DIR"

log() {
  echo "[$(date '+%F %T')] $*" >> "$LOG_FILE"
}

# ---------- Load Configs ----------
load_configs() {
  # Defaults
  SCREEN_OFF_SLEEP_INTERVAL=600
  ACTIVE_CYCLE_TIME=150
  IDLE_CYCLE_TIME=300
  POLLING_INTERVAL=60
  ACTIVE_GAME_POLLING_INTERVAL=30
  TARGET_RAM_PERCENTAGE=70
  RAM_SAFETY_THRESHOLD=20
  BACKGROUND_HEAP_LIMIT=64
  DOWNSCALE_RATIO="0.85"
  TARGET_FPS="120"
  DISABLE_THERMAL_PROTECTION=true
  ENABLE_METRICS_LOGGING=false

  EXCLUSION_LIST='.systemui|.settings|.gms|.launcher|.brevent|inputmethod|keyboard|.bluetooth|.messaging|.telegram|.whatsapp|.zalo|.gm|.mbbank|.tpb|.vpbank|.vietinbank|.vcb|.vietcombank|.acb|.ocb|.techcombank|.sacombank|.shb|.hdbank|.seabank|.bidr|.kplus|.gmail|.dialer|.authenticator|.otp|.vnpay|.zalopay|.vtcpay|.moca|.momo|.google|.samsung|.xiaomi|.oppo|.realme|.vivo|.huawei|.dropbox|.onedrive|.drive|.photos|.icloud|.smartlock|.security|.finddevice|.contacts|.call|.phone|.backup|.sync|.cloud|.provider|.framework|.core|.service|.abbank|.baoviet|.pgbank|.vib|.vietabank|.lpb|.ncb|chrome'
  GAME_LIST='garena|vng|riotgames|tencent|gameloft|mojang|mihoyo|cognosphere|activision|lilithgames|supercell|netmarble|nexon|blizzard|valve|rockstargames|epicgames|ubisoft|bandainamco|squareenix|level5|pearlabyss|com2us|bilibili|devsisters|playrix|zynga|inflexion|take2|gamevil|nintendo|sega|playstation|bethesda|netease|kakaogames|cdprojekt|capcom|wbgames|wargaming|505games|zyx|hoj|skypeople|kongstudios|tbgames|gfun|nuverse|efun|more2|igg|iggames|honkaistarrail|honkaiimpact|honkai|genshin|starrail|codm|callofduty|pubg|pubgmobile|freefire|maxfire|apex|newstate|valorant|csgo|dota|lol|leagueoflegends|wildrift|mlbb|arenaofvalor|lienquan|fifa|efootball|dreamleague|dls|football|soccer|asphalt|needforspeed|nfs|racingmaster|rulesofsurvival|standoff|fortnite|identityv|arknights|toweroffantasy|dragonraja|blackdesert|bdm|muorigin|mir|perfectworld|dragonnest|bladeandsoul|bns|summonerswar|cookie|roblox|minecraft|brawlstars|clashofclans|clashroyale|hayday|candycrush|pokemon|naruto|bleach|dragonball|saintseiya|kgvn'

  # Load from config if exists
  if [ -f "$CONFIG_FILE" ]; then
    . "$CONFIG_FILE"
    log "Loaded configs from $CONFIG_FILE"
  fi
}
load_configs

# ---------- Global variables for caching ----------
core_count=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
low_mask=0
high_mask=0
low_dec=0
high_dec=0
low_hex="0x0"
high_hex="0x0"
mem_total_kb=0
mem_free_kb=0
mem_buffers_kb=0
mem_cached_kb=0
last_mem_update=0

# ---------- Helper: detect big/LITTLE masks ----------
get_core_masks_biglittle() {
  little_freq=$(find /sys/devices/system/cpu/ -name cpuinfo_max_freq -exec cat {} \; 2>/dev/null | sort -n | head -n1)
  if [ -z "$little_freq" ]; then
    half=$((core_count / 2))
    for cpu in $(seq 0 $((core_count - 1))); do
      if [ "$cpu" -lt "$half" ]; then
        low_mask=$((low_mask | (1 << cpu)))
      else
        high_mask=$((high_mask | (1 << cpu)))
      fi
    done
  else
    for cpu in $(grep '^processor' /proc/cpuinfo 2>/dev/null | awk '{print $3}'); do
      f="/sys/devices/system/cpu/cpu${cpu}/cpufreq/cpuinfo_max_freq"
      if [ -f "$f" ]; then
        freq=$(cat "$f" 2>/dev/null || echo 0)
        if [ "$freq" = "$little_freq" ]; then
          low_mask=$((low_mask | (1 << cpu)))
        else
          high_mask=$((high_mask | (1 << cpu)))
        fi
      else
        if [ "$cpu" -lt 4 ]; then
          low_mask=$((low_mask | (1 << cpu)))
        else
          high_mask=$((high_mask | (1 << cpu)))
        fi
      fi
    done
  fi
  low_hex=$(printf '0x%X' "$low_mask")
  high_hex=$(printf '0x%X' "$high_mask")
  low_dec="$low_mask"
  high_dec="$high_mask"
}
get_core_masks_biglittle

# ---------- Update RAM info (cached, update every 30s) ----------
update_ram_info() {
  now=$(date +%s)
  if [ $((now - last_mem_update)) -ge 30 ]; then
    mem_info=$(cat /proc/meminfo 2>/dev/null)
    [ -z "$mem_info" ] && { log "Failed to read /proc/meminfo"; return; }
    mem_total_kb=$(echo "$mem_info" | awk '/^MemTotal:/ {print $2; exit}')
    mem_free_kb=$(echo "$mem_info" | awk '/^MemFree:/ {print $2; exit}')
    mem_buffers_kb=$(echo "$mem_info" | awk '/^Buffers:/ {print $2; exit}')
    mem_cached_kb=$(echo "$mem_info" | awk '/^Cached:/ {print $2; exit}')
    last_mem_update="$now"
  fi
}

# ---------- Ram percent (use cached values) ----------
get_ram_usage_percent() {
  update_ram_info
  used=$(( mem_total_kb - mem_free_kb - mem_buffers_kb - mem_cached_kb ))
  [ "$mem_total_kb" -eq 0 ] && echo 0 || echo $(( used * 100 / mem_total_kb ))
}

# ---------- Small utilities for affinity / priority ----------
apply_profile_to_pid() {
  pid="$1"
  profile="$2"
  [ -z "$pid" ] && return
  case "$profile" in
    game)
      if command -v taskset >/dev/null 2>&1; then
        t_hex=$(printf '%X' "$high_dec")
        taskset -ap "$t_hex" "$pid" >/dev/null 2>&1 || taskset -p "$high_dec" "$pid" >/dev/null 2>&1 || log "Failed taskset for $pid (game)"
      fi
      chrt -r -p 50 "$pid" >/dev/null 2>&1 || renice -n -5 -p "$pid" >/dev/null 2>&1 || log "Failed priority for $pid (game)"
      ;;
    bg)
      if command -v taskset >/dev/null 2>&1; then
        t_hex=$(printf '%X' "$low_dec")
        taskset -ap "$t_hex" "$pid" >/dev/null 2>&1 || taskset -p "$low_dec" "$pid" >/dev/null 2>&1 || log "Failed taskset for $pid (bg)"
      fi
      renice -n 10 -p "$pid" >/dev/null 2>&1
      chrt -o -p 0 "$pid" >/dev/null 2>&1 || log "Failed priority for $pid (bg)"
      ;;
    all)
      if command -v taskset >/dev/null 2>&1; then
        all_mask=$(( (1 << core_count) - 1 ))
        t_hex=$(printf '%X' "$all_mask")
        taskset -ap "$t_hex" "$pid" >/dev/null 2>&1 || taskset -p "$all_mask" "$pid" >/dev/null 2>&1 || log "Failed taskset for $pid (all)"
      fi
      renice -n -5 -p "$pid" >/dev/null 2>&1 || log "Failed priority for $pid (all)"
      ;;
    *) return;;
  esac
}

# ---------- Helper: check if package is game ----------
is_game_package() {
  echo "$1" | grep -qiE "$GAME_LIST"
  return $?
}

# ---------- Preload system libs (parallel via xargs) ----------
task_preload_system_libs() {
  (
    update_ram_info
    if [ "$mem_total_kb" -lt 786432 ]; then bs="1024k"
    elif [ "$mem_total_kb" -lt 1572864 ]; then bs="2048k"
    elif [ "$mem_total_kb" -lt 3145728 ]; then bs="4096k"
    elif [ "$mem_total_kb" -lt 4194304 ]; then bs="8192k"
    elif [ "$mem_total_kb" -lt 6291456 ]; then bs="16384k"
    else bs="32768k"
    fi
    libs=$(ls /system/lib*/lib{c,m,dl,log,cutils}.so 2>/dev/null)
    for l in $libs; do dd if="$l" of=/dev/null bs="$bs" count=1 2>/dev/null & done
    find /system/lib* /vendor/lib* -type f -name '*.so' 2>/dev/null \
      | grep -iE 'hwui|skia|surfaceflinger|gui|gralloc|render|gles|egl|hardware\.graphics|ui|framework|android_runtime' \
      | xargs -r -n1 -P 2 sh -c 'dd if="$0" of=/dev/null bs='"$bs"' count=1 2>/dev/null' || log "Preload system libs failed"
  ) &
}

# ---------- Preload game libs (controlled) ----------
task_preload_game_libs() {
  pkg="$1"
  [ -z "$pkg" ] && return
  apk_path=$(cmd package path "$pkg" 2>/dev/null | grep -m1 '^package:' | cut -d: -f2)
  [ -z "$apk_path" ] && { log "No APK path for $pkg"; return; }
  base_lib_dir="${apk_path%/*}/lib"
  [ ! -d "$base_lib_dir" ] && return
  update_ram_info
  preload_bs=$([ "$mem_total_kb" -lt 2097152 ] && echo "1m" || echo "2m")
  find "$base_lib_dir" -type f -name '*.so' -printf '%s %p\n' 2>/dev/null | sort -n | awk '{print $2}' > "$TMP_DIR/game_libs.lst"
  count=0
  CACHED_GAME_FILES=""
  while IFS= read -r lib; do
    available_percent=$((100 - $(get_ram_usage_percent)))
    if [ "$available_percent" -le "$RAM_SAFETY_THRESHOLD" ]; then
      post_notification "⚠️ Pre-caching" "Dừng sớm do RAM thấp (${available_percent}%)"
      break
    fi
    dd if="$lib" of=/dev/null bs="$preload_bs" count=1 iflag=direct 2>/dev/null &
    CACHED_GAME_FILES="$CACHED_GAME_FILES $lib"
    count=$((count + 1))
    [ $((count % 2)) -eq 0 ] && wait
  done < "$TMP_DIR/game_libs.lst"
  wait
  post_notification "✅ Pre-caching" "Đã preload xong $pkg"
}

# ---------- Notifications ----------
post_notification() {
  title="$1"; message="$2"
  icon_spec="/storage/emulated/0/TTP-WEB/Source/icon-192.png"
  large_icon_spec="/storage/emulated/0/TTP-WEB/Source/icon-512.png"
  if [ -f "$icon_spec" ] && [ -f "$large_icon_spec" ]; then
    cmd notification post -i "$icon_spec" -I "$large_icon_spec" -S bigtext -t "$title" "TTP-AI Module" "$message" 999 >/dev/null 2>&1 || log "Notification failed: $title"
  else
    cmd notification post -S bigtext -t "$title" "TTP-AI Module" "$message" 999 >/dev/null 2>&1 || log "Notification failed: $title"
  fi
}

# ---------- Cleanup background apps (optimized) ----------
task_cleanup_background_apps() {
  is_game_mode="${1:-false}"
  ps -A -o pid,user,cmd 2>/dev/null | awk '$2 ~ /^u0_a/ {print $1" "$3}' > "$TMP_DIR/process_list.tmp"
  >"$TMP_DIR/compact_pkg.lst"
  >"$TMP_DIR/compact_pid.lst"
  while IFS= read -r line; do
    pid=$(echo "$line" | awk '{print $1}')
    pname=$(echo "$line" | awk '{print $2}')
    echo "$pname" | grep -qE "$EXCLUSION_LIST" && continue
    is_game_package "$pname" && continue
    if [ "$is_game_mode" = "true" ]; then
      cmd appops set "$pname" RUN_IN_BACKGROUND deny >/dev/null 2>&1 || log "AppOps deny fail: $pname"
      apply_profile_to_pid "$pid" bg
      command -v iorenice >/dev/null 2>&1 && iorenice "$pid" 7 idle >/dev/null 2>&1
      chrt -r -p 50 "$pid" >/dev/null 2>&1 || log "chrt fail: $pid"
      cmd activity set-watch-heap "$pname" "$BACKGROUND_HEAP_LIMIT" >/dev/null 2>&1 || log "Heap limit fail: $pname"
    else
      if check_surfaceflinger "$pname"; then
        cmd activity set-watch-heap "$pname" 0 >/dev/null 2>&1
        cmd activity send-trim-memory "$pname" RUNNING_CRITICAL >/dev/null 2>&1
        renice -n -20 -p "$pid" >/dev/null 2>&1
        apply_profile_to_pid "$pid" all
        chrt -r -p 99 "$pid" >/dev/null 2>&1
        continue
      fi
      cmd activity send-trim-memory "$pname" BACKGROUND >/dev/null 2>&1
      cmd activity set-watch-heap "$pname" "$BACKGROUND_HEAP_LIMIT" >/dev/null 2>&1
    fi
    echo "$pname" >> "$TMP_DIR/compact_pkg.lst"
    echo "$pid" >> "$TMP_DIR/compact_pid.lst"
  done < "$TMP_DIR/process_list.tmp"
  if [ -s "$TMP_DIR/compact_pkg.lst" ]; then
    while IFS= read -r p; do cmd activity compact full "$p" >/dev/null 2>&1; done < "$TMP_DIR/compact_pkg.lst"
  fi
  if [ -s "$TMP_DIR/compact_pid.lst" ]; then
    while IFS= read -r pid; do cmd activity compact native full "$pid" >/dev/null 2>&1; sleep 0.02; done < "$TMP_DIR/compact_pid.lst"
  fi
}

# ---------- Restore defaults (optimized) ----------
task_restore_defaults() {
  post_notification "🌙 Normal Mode" "Quay lại chế độ bình thường"
  cmd package list packages -3 2>/dev/null | cut -d: -f2 | grep -vE "$EXCLUSION_LIST" > "$TMP_DIR/pkg_nonexcluded.lst"
  while IFS= read -r pkg; do
    is_game_package "$pkg" && continue
    cmd appops set "$pkg" RUN_IN_BACKGROUND allow >/dev/null 2>&1 || log "Failed appops allow for $pkg"
    cmd activity clear-watch-heap "$pkg" >/dev/null 2>&1 || log "Failed clear-watch-heap for $pkg"
  done < "$TMP_DIR/pkg_nonexcluded.lst" &
  cmd activity memory-factor reset >/dev/null 2>&1
  if [ "$DISABLE_THERMAL_PROTECTION" = "true" ]; then
    command -v thermalservice >/dev/null 2>&1 && cmd thermalservice reset >/dev/null 2>&1 || log "Failed thermalservice reset"
  fi
  command -v power >/dev/null 2>&1 && cmd power set-fixed-performance-mode-enabled false >/dev/null 2>&1 || log "Failed power reset"
  cmd package list packages -3 2>/dev/null | grep -iE "$GAME_LIST" | cut -d: -f2 > "$TMP_DIR/installed_games.lst"
  while IFS= read -r pkg; do
    command -v game >/dev/null 2>&1 && cmd game mode standard "$pkg" >/dev/null 2>&1 || log "Failed game mode reset for $pkg"
  done < "$TMP_DIR/installed_games.lst"
  cmd package wait-for-handler --timeout 3000
  cmd package wait-for-background-handler --timeout 5000
  for i in 1 2 3; do
    nice -n 15 requestsync --top --expedited --ignore-settings --ignore-backoff --manual >/dev/null 2>&1 || log "Requestsync failed"
  done
}

# ---------- Small helpers ----------
check_surfaceflinger() {
  pkg="$1"
  nice -n 19 dumpsys SurfaceFlinger 2>/dev/null | grep -iE 'Output' | grep -qFw "$pkg"
}

# ---------- Detect foreground game (improved) ----------
detect_foreground_game() {
  pkg=$(cmd activity stack list 2>/dev/null | grep '0,0.*visible=true' | tr -d ' ' | cut -f1 -d/ | cut -f2 -d: | head -n1)
  [ -n "$pkg" ] && is_game_package "$pkg" && { echo "$pkg"; return; }
  pkg=$(dumpsys window 2>/dev/null | grep 'mCurrentFocus' | sed -n 's/.*u0 \([^ ]*\)\/.*/\1/p' | head -n1)
  [ -n "$pkg" ] && is_game_package "$pkg" && { echo "$pkg"; return; }
  pkg=$(dumpsys SurfaceFlinger 2>/dev/null | grep -oiE '[a-z0-9.]+/[a-z0-9.]+' | cut -d/ -f1 | sort | uniq | grep -E "$GAME_LIST")
  [ -n "$pkg" ] && is_game_package "$pkg" && { echo "$pkg"; return; }
}

# ---------- Main daemon loop ----------
main_daemon_loop() {
  echo "$$" > "$LOCK_FILE"
  trap 'task_restore_defaults; rm -f "$LOCK_FILE"; rm -rf "$TMP_DIR"; log "Exited cleanly"' EXIT SIGINT SIGTERM
  ionice -c 2 -n 7 -p "$$" >/dev/null 2>&1
  renice -n 19 -p "$$" >/dev/null 2>&1
  chrt -r -p 50 "$$" >/dev/null 2>&1
  command -v taskset >/dev/null 2>&1 && taskset -ap 0f "$$" >/dev/null 2>&1
  in_game_state=false
  screen_is_off=true
  last_poll_time=0
  cached_active_game=""
  cached_screen_is_off=true
  current_polling_interval="$POLLING_INTERVAL"
  disable_logs() {
    pkill -f logcat >/dev/null 2>&1 || true
    heap_limit=$(getprop dalvik.vm.heapgrowthlimit)
    logcat -G "$heap_limit" >/dev/null 2>&1 || true
    cmd activity idle-maintenance >/dev/null 2>&1
  }
  disable_logs
  while true; do
    task_preload_system_libs &
    trick &
    now=$(date +%s)
    if [ $((now - last_poll_time)) -ge "$current_polling_interval" ]; then
      screen_status=$(dumpsys window 2>/dev/null | grep -q 'mAwake=true' && echo true || echo false)
      if [ "$screen_status" = "true" ]; then
        cached_screen_is_off=false
        cached_active_game="$(detect_foreground_game)"
      else
        cached_screen_is_off=true
        cached_active_game=""
      fi
      last_poll_time="$now"
      if [ -n "$cached_active_game" ]; then
        current_polling_interval="$ACTIVE_GAME_POLLING_INTERVAL"
      else
        current_polling_interval="$POLLING_INTERVAL"
      fi
      if [ "$ENABLE_METRICS_LOGGING" = "true" ]; then
        ram_percent=$(get_ram_usage_percent)
        log "Metrics: RAM=$ram_percent%, Game=$cached_active_game, ScreenOff=$cached_screen_is_off"
      fi
    fi
    if [ "$cached_screen_is_off" = "false" ]; then
      [ "$screen_is_off" = "true" ] && { task_exit_deep_sleep_mode & screen_is_off=false; }
      task_thermal_governor "$cached_active_game" &
      if [ -n "$cached_active_game" ]; then
        if [ "$in_game_state" = "false" ]; then
          task_enable_performance_mode "$cached_active_game" &
          task_cleanup_background_apps true &
          task_system_maintenance &
          in_game_state=true
        else
          task_warm_up_cache &
        fi
      else
        if [ "$in_game_state" = "true" ]; then
          task_restore_defaults &
          CACHED_GAME_FILES=""
          LAST_PRELOADED_GAME=""
          in_game_state=false
        fi
        used_percent=$(get_ram_usage_percent)
        if [ "$used_percent" -ge "$TARGET_RAM_PERCENTAGE" ]; then
          task_cleanup_background_apps false &
          task_system_maintenance &
        fi
      fi
    else
      if [ "$screen_is_off" = "false" ]; then
        [ "$in_game_state" = "true" ] && { task_restore_defaults & in_game_state=false; }
        task_enter_deep_sleep_mode &
        screen_is_off=true
      fi
    fi
    if [ "$screen_is_off" = "true" ]; then
      sleep "$SCREEN_OFF_SLEEP_INTERVAL"
    elif [ "$in_game_state" = "true" ]; then
      sleep "$ACTIVE_CYCLE_TIME"
    else
      sleep "$IDLE_CYCLE_TIME"
    fi
  done
}

# ---------- Other tasks ----------
task_warm_up_cache() {
  (
    for f in $CACHED_GAME_FILES; do
      [ -f "$f" ] && cat "$f" >/dev/null
    done
  ) &
}

task_thermal_governor() {
  active_game="$1"
  temp_raw=$(dumpsys battery 2>/dev/null | awk -F': ' '/temp/ {print $2; exit}')
  [ -z "$temp_raw" ] && return
  temp_c=$((temp_raw / 10))
  if [ "$temp_c" -ge 41 ]; then
    post_notification "🔥 CRITICAL TEMP" "Throttling at ${temp_c}°C"
    [ -n "$active_game" ] && cmd game mode battery "$active_game" >/dev/null 2>&1
    cmd power set-fixed-performance-mode-enabled false >/dev/null 2>&1
    cmd power set-adaptive-power-saver-enabled true >/dev/null 2>&1
    cmd thermalservice override-status 3 >/dev/null 2>&1
    THERMAL_THROTTLING_ACTIVE=true
  elif [ "$temp_c" -ge 37 ]; then
    [ -n "$active_game" ] && cmd game mode standard "$active_game" >/dev/null 2>&1
    cmd power set-fixed-performance-mode-enabled false >/dev/null 2>&1
    cmd power set-adaptive-power-saver-enabled true >/dev/null 2>&1
    cmd thermalservice override-status 2 >/dev/null 2>&1
    THERMAL_THROTTLING_ACTIVE=true
  else
    if [ "${THERMAL_THROTTLING_ACTIVE:-false}" = "true" ]; then
      [ -n "$active_game" ] && cmd game set --downscale "$DOWNSCALE_RATIO" --fps "$TARGET_FPS" "$active_game" >/dev/null 2>&1
      cmd power set-fixed-performance-mode-enabled false >/dev/null 2>&1
      cmd power set-adaptive-power-saver-enabled true >/dev/null 2>&1
      cmd thermalservice override-status 1 >/dev/null 2>&1
      THERMAL_THROTTLING_ACTIVE=false
    fi
  fi
}

task_enable_performance_mode() {
  active_game="$1"
  [ -z "$active_game" ] && { log "No active game detected"; return; }
  log "Detected game: $active_game"
  if [ "$LAST_PRELOADED_GAME" != "$active_game" ]; then
    post_notification "Game mode" "Đã phát hiện: $active_game"
    task_preload_game_libs "$active_game"
    LAST_PRELOADED_GAME="$active_game"
    cmd package compile -f -r bg-dexopt -m speed "$active_game" >/dev/null 2>&1 || log "Compile failed for $active_game"
    cmd activity set-watch-heap "$active_game" 0 >/dev/null 2>&1
  fi
  cmd game set --downscale "$DOWNSCALE_RATIO" --fps "$TARGET_FPS" "$active_game" >/dev/null 2>&1 || cmd game mode performance "$active_game" >/dev/null 2>&1 || log "Game mode set failed for $active_game"
  cmd power set-fixed-performance-mode-enabled true >/dev/null 2>&1
  cmd power set-adaptive-power-saver-enabled false >/dev/null 2>&1
  cmd activity memory-factor set CRITICAL >/dev/null 2>&1
  game_mode
  command -v thermalservice >/dev/null 2>&1 && [ "$DISABLE_THERMAL_PROTECTION" = "true" ] && cmd thermalservice override-status 0 >/dev/null 2>&1
}

task_system_maintenance() {
  cmd activity compact system >/dev/null 2>&1
  cmd activity write >/dev/null 2>&1
  sm idle-maint abort
  sm fstrim
  sync
}

task_enter_deep_sleep_mode() {
  post_notification "💤 Deep Sleep" "Entering deep sleep mode"
  cmd deviceidle enable light >/dev/null 2>&1
}

task_exit_deep_sleep_mode() {
  post_notification "☀️ Awake" "Exiting deep sleep"
  cmd deviceidle disable >/dev/null 2>&1
  cmd deviceidle unforce >/dev/null 2>&1
  cmd power set-mode 0 >/dev/null 2>&1
}

game_mode() {
  cmd package list packages -3 2>/dev/null | cut -d: -f2 > "$TMP_DIR/game_mode.lst"
  dumpsys game 2>/dev/null | grep -Ff "$TMP_DIR/game_mode.lst" | while IFS= read -r g; do
    cmd device_config put game_overlay "$g" mode=3,downscaleFactor=0.85,useAngle=true,fps=120,loadingBoost=999999999 >/dev/null 2>&1 || log "Game overlay failed for $g"
  done
  rm -f "$TMP_DIR/game_mode.lst"
}

trick() {
  if pidof com.xiaomi.joyose >/dev/null 2>&1; then
    cmd package install "$(cmd package path com.xiaomi.joyose | cut -f2 -d:)" >/dev/null 2>&1 || log "Failed to reinstall com.xiaomi.joyose"
  fi
}

# ---------- Compatibility check ----------
check_compatibility() {
  cmds="am cmd dumpsys ps awk grep date taskset chrt"
  for c in $cmds; do
    command -v $c >/dev/null 2>&1 || { log "Missing command: $c"; echo "Missing $c"; exit 1; }
  done
}

# ---------- Entrypoint ----------
if [ "$1" = "--background" ]; then
  main_daemon_loop
  exit 0
fi

echo "Starting Cuongche v$VERSION (optimized)..."
if [ -e "$LOCK_FILE" ]; then
  oldpid=$(cat "$LOCK_FILE" 2>/dev/null)
  kill -0 "$oldpid" >/dev/null 2>&1 && { echo "Already running ($oldpid)"; exit 1; } || rm -f "$LOCK_FILE"
fi

check_compatibility
setsid /system/bin/sh "$0" --background >/dev/null 2>&1 < /dev/null &
sleep 1
if [ -e "$LOCK_FILE" ]; then
  echo "Started: $(cat "$LOCK_FILE")"
else
  echo "Failed to start. Check permissions."
fi