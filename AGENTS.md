
- Profile PINs are hashed and hidden from clients; read `has_pin` and use the `set_profile_pin`/`verify_profile_pin` database functions — never select `*` on household_profiles (column grants exclude `pin`).
