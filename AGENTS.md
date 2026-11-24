
- Profile PINs are hashed and hidden from clients; read `has_pin` and use the `set_profile_pin`/`verify_profile_pin` database functions — never select `*` on household_profiles (column grants exclude `pin`).
- Self-deletion must derive identity from authenticated middleware, check upload removal, run server-only transactional record cleanup, and delete auth last; this prevents false success and cross-account deletion.
- Keep account-deletion controls shared between Settings and the public deletion page, and public legal/support content in dedicated routes; this keeps behavior consistent and permits store-required access without the installed app.
- Managed Apple authorization is disconnected via the same-origin `/~oauth/apple/revoke` page after account deletion, never with app-held Apple credentials; Lovable owns the managed grant.
- Exclude `/~oauth` and API navigations from offline fallbacks and caching; sign-in and revocation must reach the network.
- Household subscription status must resolve household membership from authenticated identity and read only server-managed store entitlements or personal-access allowances; client claims and legacy checkout records are not proof of payment.
- Keep subscription enforcement disabled during store preparation and exclude subscription queries from persisted offline caches; enabling restrictions requires verified store purchases and separately tested data-access enforcement.
- Calendar expansion measures unclamped event content against the default week layout and caps each week at twice its normal height; keep the default rendering unchanged and use local state so collapse restores it.
- Use the shared surface Button variant for secondary page controls placed directly over themed backdrops; card-colored tiles preserve legibility without changing controls inside cards or dialogs.
