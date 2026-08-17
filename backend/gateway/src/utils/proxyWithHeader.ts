import proxy from "express-http-proxy";
import { AuthenticatedRequest } from "../middleware/auth.js";

interface ProxyOptions {
  preservePath?: boolean;
}

const proxyWithHeader = (service_url: string, options: ProxyOptions = {}) => {
  return proxy(service_url, {
    ...(options.preservePath ? { proxyReqPathResolver: (req) => req.originalUrl } : {}),
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      const req = srcReq as AuthenticatedRequest;
    
      proxyReqOpts.headers = {
        ...proxyReqOpts.headers,
        ...(req.user?._id ? { "x-user-id": String(req.user._id) } : {}),
        ...(req.user?.name ? { "x-user-name": String(req.user.name) } : {}),
        ...(req.user?.email ? { "x-user-email": String(req.user.email) } : {}),
        "x-user-role": req.user?.role || "user",
      };

      return proxyReqOpts;
    },
  });
};

export default proxyWithHeader;
