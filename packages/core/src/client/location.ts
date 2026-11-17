import { ScramjetClient } from "@client/index";
import { Tap } from "@/Tap";
import { iswindow } from "@client/entry";
import { SCRAMJETCLIENT } from "@/symbols";
import {
	Reflect_apply,
	Reflect_get,
	Reflect_has,
	Object_setPrototypeOf,
	_URL,
	Object_defineProperty,
} from "@/shared/snapshot";

export function createLocationProxy(client: ScramjetClient, self: GlobalThis) {
	const Location = iswindow ? self.Location : self.WorkerLocation;
	// location cannot be Proxy()d
	const fakeLocation: any = {};
	Object_setPrototypeOf(fakeLocation, Location.prototype);
	fakeLocation.constructor = Location;

	// for some reason it's on the object for Location and on the prototype for WorkerLocation??
	const descriptorSource = iswindow ? self.location : Location.prototype;
	const urlprops = [
		"protocol",
		"hash",
		"host",
		"hostname",
		"href",
		"origin",
		"pathname",
		"port",
		"search",
	];
	for (const prop of urlprops) {
		const native = client.natives.call(
			"Object.getOwnPropertyDescriptor",
			null,
			descriptorSource,
			prop
		);
		if (!native) continue;

		const desc: Partial<PropertyDescriptor> = {
			configurable: false,
			enumerable: true,
		};
		if (native.get) {
			desc.get = new Proxy(native.get, {
				apply() {
					return client.url[prop];
				},
			});
		}
		if (native.set) {
			desc.set = new Proxy(native.set, {
				apply(target, that, args) {
					if (prop === "href") {
						// special case
						client.url = args[0];

						return;
					}
					if (prop === "hash") {
						self.location.hash = args[0];
						Tap.dispatch(
							client.hooks.lifecycle.navigate,
							{
								type: "hashchange",
							},
							{
								url: client.url.href,
							}
						);

						return;
					}
					const url = new _URL(client.url.href);
					url[prop] = args[0];
					client.url = url;
				},
			});
		}
		Object_defineProperty(fakeLocation, prop, desc);
	}

	// functions
	fakeLocation.toString = new Proxy(self.location.toString, {
		apply() {
			return client.url.href;
		},
	});

	if (self.location.valueOf)
		fakeLocation.valueOf = new Proxy(self.location.valueOf, {
			apply() {
				return fakeLocation;
			},
		});
	if (self.location.assign)
		fakeLocation.assign = new Proxy(self.location.assign, {
			apply(target, that, args) {
				args[0] = client.rewriteUrl(args[0]);
				Reflect_apply(target, self.location, args);
				Tap.dispatch(
					client.hooks.lifecycle.navigate,
					{
						type: "location",
					},
					{
						url: client.url.href,
					}
				);
			},
		});
	if (self.location.reload)
		fakeLocation.reload = new Proxy(self.location.reload, {
			apply(target, that, args) {
				Reflect_apply(target, self.location, args);
			},
		});
	if (self.location.replace)
		fakeLocation.replace = new Proxy(self.location.replace, {
			apply(target, that, args) {
				args[0] = client.rewriteUrl(args[0]);
				Reflect_apply(target, self.location, args);

				Tap.dispatch(
					client.hooks.lifecycle.navigate,
					{
						type: "location",
					},
					{
						url: client.url.href,
					}
				);
			},
		});

	if (iswindow) {
		const native = client.natives.call(
			"Object.getOwnPropertyDescriptor",
			null,
			self.location,
			"ancestorOrigins"
		);
		// only expose it where the browser itself does (chromium, webkit)
		if (native?.get) {
			let list: DOMStringList | null = null;
			Object_defineProperty(fakeLocation, "ancestorOrigins", {
				configurable: false,
				enumerable: true,
				get: new Proxy(native.get, {
					apply() {
						// [SameObject]: the list is fixed when the document is created
						if (!list)
							list = createAncestorOrigins(
								self,
								Reflect_apply(native.get, self.location, [])
							);

						return list;
					},
				}),
			});
		}
	}

	return fakeLocation;
}

// the origins of the ancestor frames that are inside the proxy, nearest first.
// a window outside the proxy context is treated as if it didn't exist, the same
// way window.parent and window.top are emulated
function collectAncestorOrigins(self: GlobalThis): string[] {
	const origins: string[] = [];
	let current = self;
	for (;;) {
		let parent: GlobalThis;
		try {
			parent = current.parent.self;
			if (parent === current) break;
			if (!(SCRAMJETCLIENT in parent)) break;
		} catch {
			break;
		}
		origins.push(parent[SCRAMJETCLIENT].url.origin);
		current = parent;
	}

	return origins;
}

function createAncestorOrigins(
	self: GlobalThis,
	real: DOMStringList
): DOMStringList {
	const origins = collectAncestorOrigins(self);
	const isIndex = (prop: string | symbol): prop is string =>
		typeof prop === "string" && /^(0|[1-9]\d*)$/.test(prop);
	const inRange = (prop: string | symbol) =>
		isIndex(prop) && +prop < origins.length;

	let proxy: DOMStringList;
	const wrapMethod = (
		name: "item" | "contains",
		impl: (...args: any[]) => any
	) =>
		new Proxy(self.DOMStringList.prototype[name], {
			apply(target, that, args) {
				if (that === proxy) return impl(...args);

				return Reflect_apply(target, that, args);
			},
		});
	const item = wrapMethod("item", (index) => {
		const i = Number(index) >>> 0;

		return i < origins.length ? origins[i] : null;
	});
	const contains = wrapMethod("contains", (str) =>
		origins.includes(String(str))
	);

	proxy = new Proxy(real, {
		get(target, prop) {
			if (prop === "length") return origins.length;
			if (prop === "item") return item;
			if (prop === "contains") return contains;
			if (isIndex(prop)) return origins[+prop];

			return Reflect_get(target, prop);
		},
		has(target, prop) {
			if (isIndex(prop)) return inRange(prop);

			return Reflect_has(target, prop);
		},
		ownKeys() {
			return origins.map((_, i) => String(i));
		},
		getOwnPropertyDescriptor(target, prop) {
			if (!inRange(prop)) return undefined;

			return {
				value: origins[+(prop as string)],
				writable: false,
				enumerable: true,
				configurable: true,
			};
		},
		set() {
			return false;
		},
		defineProperty() {
			return false;
		},
		deleteProperty(target, prop) {
			return !inRange(prop);
		},
	});

	return proxy;
}
