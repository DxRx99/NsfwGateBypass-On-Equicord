import { findByProps } from "@webpack";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NSFWGateBypass",
    description: "Deep-structural override for 2026 Age-Gated Invites and Identity.",
    authors: [{ name: "dxrx99", id: 1463629522359423152n }],

    start() {
        const UserStore = findByProps("getCurrentUser");
        const InviteStore = findByProps("resolveInvite", "getInvite");

        // 1. Force 'Verified Adult' Identity
        const applyIdentityMask = () => {
            const user = UserStore?.getCurrentUser();
            if (!user) return;

            const adultDOB = "1997-05-15"; 

            // Using defineProperties to lock these against the Server-Side sync
            Object.defineProperties(user, {
                date_of_birth: { get: () => adultDOB, configurable: true },
                ageGroup: { get: () => 1, configurable: true }, // 1 = Adult Group
                ageVerificationStatus: { get: () => 3, configurable: true }, // 3 = Fully Verified
                age_gate_done: { get: () => true, configurable: true },
                underage: { get: () => false, configurable: true },
                nsfwAllowed: { get: () => true, configurable: true }
            });

            if (typeof user.flags === "number") {
                user.flags |= 2;        // Adult bit
                user.flags |= (1 << 18); // 2026 'Age Assured' bitmask
            }
        };

        const interval = setInterval(applyIdentityMask, 500);
        (this as any)._interval = interval;

        // 2. The "Deep" Invite Unlocker (The real fix for the 'Underage' error)
        if (InviteStore) {
            const forceInviteAdult = (invite: any) => {
                if (invite) {
                    // This is the specific 2026 flag that triggers the 'Under Minimum Age' error
                    invite.is_minimum_age_verified = true; 
                    invite.state = "RESOLVED";
                    
                    if (invite.guild) {
                        invite.guild.nsfw = false;
                        invite.guild.nsfw_level = 0; 
                    }
                }
                return invite;
            };

            // Patching the Async Resolver (intercepts the data from Discord's servers)
            const originalResolve = InviteStore.resolveInvite;
            InviteStore.resolveInvite = async function(...args: any[]) {
                const res = await originalResolve.apply(this, args);
                // We 'clean' the invite metadata before it ever reaches the UI
                if (res && res.invite) forceInviteAdult(res.invite);
                return res;
            };

            // Patching the Sync Getter (for chat previews)
            const originalGet = InviteStore.getInvite;
            InviteStore.getInvite = function(...args: any[]) {
                return forceInviteAdult(originalGet.apply(this, args));
            };
        }
    },

    stop() {
        if ((this as any)._interval) clearInterval((this as any)._interval);
    }
});