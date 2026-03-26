#!/data/data/com.termux/files/usr/bin/bash
# GodsEye OAuth Sync Widget
# Syncs Claude Code tokens to GodsEye on l36 server
# Place in ~/.shortcuts/ on phone for Termux:Widget

termux-toast "Syncing GodsEye auth..."

# Run sync on l36 server
SERVER="${GODSEYE_SERVER:-l36}"
RESULT=$(ssh "$SERVER" '/home/admin/godseye/scripts/sync-claude-code-auth.sh' 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # Extract expiry time from output
    EXPIRY=$(echo "$RESULT" | grep "Token expires:" | cut -d: -f2-)

    termux-vibrate -d 100
    termux-toast "GodsEye synced! Expires:${EXPIRY}"

    # Optional: restart godseye service
    ssh "$SERVER" 'systemctl --user restart godseye' 2>/dev/null
else
    termux-vibrate -d 300
    termux-toast "Sync failed: ${RESULT}"
fi
