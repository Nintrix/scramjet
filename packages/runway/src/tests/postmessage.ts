import { basicTest, multiFrameTest } from "../testcommon.ts";

export default [
	basicTest({
		name: "postmessage-fake-target-sanity",
		js: `
            const messages = [];
            const fakeTarget = {
                postMessage: (msg) => messages.push(msg)
            };
            fakeTarget.postMessage("test");
            assertEqual(messages.length, 1, "postMessage should be called");
            assertEqual(messages[0], "test", "message should be correct");
        `,
	}),
	basicTest({
		name: "postmessage-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.data, "test", "message should be correct");
                pass();
            });
            postMessage("test");
        `,
		autoPass: false,
	}),
	basicTest({
		name: "postmessage-event-meta-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.isTrusted, true, "isTrusted should be true");
                assertEqual(event.source, window, "source should be correct");
                assertEqual(event.origin, location.origin, "origin should be correct");
                pass();
            });
            postMessage("test");
        `,
		autoPass: false,
	}),
	basicTest({
		name: "postmessage-self-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.data, "test", "message should be correct");
                pass();
            });
            self.postMessage("test");
        `,
		autoPass: false,
	}),
	basicTest({
		name: "postmessage-self-event-meta-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.isTrusted, true, "isTrusted should be true");
                assertEqual(event.source, window, "source should be correct");
                assertEqual(event.origin, location.origin, "origin should be correct");
                pass();
            });
            self.postMessage("test");
        `,
		autoPass: false,
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity",
		root: {
			js: () => `
                addEventListener("message", (event) => {
                    assertEqual(event.data, "test", "message should be correct");
                    pass();
                });
            `,
			subframes: [
				{
					id: "child",
					js: () => `
                        parent.postMessage("test");
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity-reverse",
		root: {
			js: () => `
                window.onload = () => {
                    frames[0].postMessage("test-reverse");
                };
            `,
			subframes: [
				{
					id: "child",
					js: () => `
                    addEventListener("message", (event) => {
                        assertEqual(event.data, "test-reverse", "message should be correct");
                        pass();
                    });
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity-cross",
		root: {
			js: () => `
                addEventListener("message", (event) => {
                    assertEqual(event.data, "test", "message should be correct");
                    pass();
                });
            `,
			subframes: [
				{
					originid: "cross",
					id: "child",
					js: () => `
                        parent.postMessage("test", "*");
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity-reverse-cross",
		root: {
			js: () => `
                window.onload = () => {
                    frames[0].postMessage("test-reverse", "*");
                };
            `,
			subframes: [
				{
					originid: "cross",
					id: "child",
					js: () => `
                        addEventListener("message", (event) => {
                            assertEqual(event.data, "test-reverse", "message should be correct");
                            pass();
                        });
                    `,
				},
			],
		},
	}),
	// a primitive message with nothing to transfer used to report the receiving
	// window as its source. sites like google sign-in check
	// `event.source === window.parent` and drop the message otherwise
	multiFrameTest({
		name: "postmessage-multi-frame-source-to-child",
		root: {
			js: () => `
                window.onload = () => {
                    frames[0].postMessage("parent_frame_ready", "*");
                };
            `,
			subframes: [
				{
					originid: "cross",
					id: "child",
					js: () => `
                        addEventListener("message", (event) => {
                            assertEqual(event.data, "parent_frame_ready", "message should be correct");
                            assert(event.source !== window, "source must not be the receiving window");
                            assertEqual(event.source, window.parent, "source should be the parent");
                            pass();
                        });
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-source-to-parent",
		root: {
			js: () => `
                addEventListener("message", (event) => {
                    assertEqual(event.data, 42, "message should be correct");
                    assert(event.source !== window, "source must not be the receiving window");
                    assertEqual(event.source, frames[0], "source should be the child");
                    pass();
                });
            `,
			subframes: [
				{
					id: "child",
					js: () => `
                        parent.postMessage(42, "*");
                    `,
				},
			],
		},
	}),
];
