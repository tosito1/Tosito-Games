// Mock for WebsimSocket to prevent errors in non-websim environments
export class WebsimSocket {
    constructor() {
        console.log('WebsimSocket Mock Initialized');
    }
    send() {}
    set onmessage(val) {}
    collection() {
        return {
            filter: () => ({ getList: async () => [] }),
            create: async () => ({}),
            delete: async () => ({}),
            upsert: async () => ({}),
            subscribe: () => () => {}
        };
    }
}

window.websim = {
    getCurrentUser: async () => ({ username: 'Anonymous', id: '123' }),
    getRoom: async () => ({})
};
