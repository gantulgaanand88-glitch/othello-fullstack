# Preserve generic signatures and runtime annotations used by networking and serialization.
-keepattributes Signature,*Annotation*

# Socket.IO registers listeners dynamically by event name. Keep its compact client runtime intact.
-keep class io.socket.** { *; }
-keep class io.socket.engineio.** { *; }

# Optional JSR-305 annotations are compile-time only.
-dontwarn javax.annotation.**
