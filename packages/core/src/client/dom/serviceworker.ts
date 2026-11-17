import { ScramjetClient } from "@client/index";
import { Object_setPrototypeOf, String, _URL } from "@/shared/snapshot";

// the proxy owns the real service worker registration, so the page can't be
// handed the real container: its controller is the proxy's worker and its
// message events are the proxy's. instead the page gets a container of its own
// that behaves like one where service workers aren't available to the site (as
// with blocked site data): nothing controls the page, nothing is registered and
// register() rejects. removing navigator.serviceWorker entirely is observable in
// every secure context and makes pwas take a different path.
//
// type self as any here, ServiceWorkerContainer is window-only in the types
export default function (client: ScramjetClient, self: any) {
	const Container = self.ServiceWorkerContainer;
	if (!Container) return;

	// a real EventTarget so add/removeEventListener and dispatchEvent work on it
	const container = new self.EventTarget();
	Object_setPrototypeOf(container, Container.prototype);
	const isOurs = (that: any) => that === container;

	// with nothing registered, ready never settles
	const ready = new self.Promise(() => {});
	const handlers: Record<string, any> = {
		oncontrollerchange: null,
		onmessage: null,
		onmessageerror: null,
	};

	client.Trap("Navigator.prototype.serviceWorker", {
		get(ctx) {
			if (ctx.this === self.navigator) return container;

			return ctx.get();
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.controller", {
		get(ctx) {
			if (isOurs(ctx.this)) return null;

			return ctx.get();
		},
	});
	client.Trap("ServiceWorkerContainer.prototype.ready", {
		get(ctx) {
			if (isOurs(ctx.this)) return ready;

			return ctx.get();
		},
	});
	for (const name in handlers) {
		client.Trap(`ServiceWorkerContainer.prototype.${name}`, {
			get(ctx) {
				if (isOurs(ctx.this)) return handlers[name];

				return ctx.get();
			},
			set(ctx, v) {
				if (!isOurs(ctx.this)) return ctx.set(v);
				handlers[name] = typeof v === "function" ? v : null;
			},
		});
	}

	client.Proxy("ServiceWorkerContainer.prototype.register", {
		apply(ctx) {
			if (!isOurs(ctx.this)) return;
			let message =
				"Failed to register a ServiceWorker: The user denied permission to use Service Worker.";
			try {
				const script = new _URL(String(ctx.args[0]), client.url.href);
				const scope = new _URL(
					ctx.args[1]?.scope !== undefined
						? String(ctx.args[1].scope)
						: "./",
					script.href
				);
				message = `Failed to register a ServiceWorker for scope ('${scope.href}') with script ('${script.href}'): The user denied permission to use Service Worker.`;
			} catch {}
			ctx.return(
				self.Promise.reject(new self.DOMException(message, "SecurityError"))
			);
		},
	});
	client.Proxy("ServiceWorkerContainer.prototype.getRegistration", {
		apply(ctx) {
			if (isOurs(ctx.this)) ctx.return(self.Promise.resolve(undefined));
		},
	});
	client.Proxy("ServiceWorkerContainer.prototype.getRegistrations", {
		apply(ctx) {
			if (isOurs(ctx.this)) ctx.return(self.Promise.resolve(new self.Array()));
		},
	});
	client.Proxy("ServiceWorkerContainer.prototype.startMessages", {
		apply(ctx) {
			if (isOurs(ctx.this)) ctx.return(undefined);
		},
	});
}
