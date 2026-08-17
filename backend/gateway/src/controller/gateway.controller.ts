import { AuthenticatedRequest } from "../middleware/auth.js";
import tryCatch from "../middleware/tryCatch.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

export const getCurrentUser = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      return sendError(res, "user not found", null, 404);
    }
    return sendSuccess(res, "User Found Successfully", {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role || "user",
    });
  },
);
