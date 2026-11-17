// delete chrome specific apis that would expose the proxy and aren't emulated yet.
// every api removed here is a difference a page can observe (feature detection,
// fingerprinting), so only delete what can't be left native. apis that never see
// a url or an origin (bluetooth, hid, contact picker, idle detection, shape
// detection, window controls overlay, ...) are left alone.

import { iswindow } from "@client/entry";
import { ScramjetClient } from "@client/index";

// type self as any here, most of these are not defined in the types
export default function (client: ScramjetClient, self: any) {
	const del = (name: string) => {
		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], self);
		if (!target) return;
		if (prop && prop in target) {
			delete target[prop];
		} else {
		}
	};

	// protected audience: fetches bidding/scoring urls directly and keys
	// interest groups on the real (proxy) origin
	del("Navigator.prototype.joinAdInterestGroup");

	if (!iswindow) return;
	// DOM specific ones below here

	// Navigation API (not chrome only but it's really annoying to implement)
	del("navigation");
	del("NavigateEvent");
	del("NavigationActivation");
	del("NavigationCurrentEntryChangeEvent");
	del("NavigationDestination");
	del("NavigationHistoryEntry");
	del("NavigationTransition");
}
