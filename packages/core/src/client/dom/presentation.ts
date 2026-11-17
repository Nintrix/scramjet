import { ScramjetClient } from "@client/index";
import { Array_isArray, String, _URL } from "@/shared/snapshot";

// presentation urls are loaded by the receiving display, not through the proxy,
// so relative urls have to resolve against the site's real url
export default function (client: ScramjetClient, self: any) {
	if (!self.PresentationRequest) return;

	const resolve = (url: any) => {
		try {
			return new _URL(String(url), client.url.href).href;
		} catch {
			// let the native constructor throw its own SyntaxError
			return url;
		}
	};

	client.Proxy("PresentationRequest", {
		construct(ctx) {
			const urls = ctx.args[0];
			if (Array_isArray(urls)) {
				const resolved = [];
				for (let i = 0; i < urls.length; i++) resolved.push(resolve(urls[i]));
				ctx.args[0] = resolved;
			} else if (urls !== undefined) {
				ctx.args[0] = resolve(urls);
			}
		},
	});
}
