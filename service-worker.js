/* 아버지의 50번째 생일 — 서비스 워커 (캐시 우선)
 * 첫 방문 이후에는 네트워크가 없어도 페이지가 열립니다.
 */
var CACHE_NAME = "birthday50-v6";
var PRECACHE = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(PRECACHE);
            })
            .then(function () {
                return self.skipWaiting();
            })
            .catch(function () {
                /* 일부 자산이 없어도 설치는 계속 진행합니다. */
            })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches
            .keys()
            .then(function (keys) {
                return Promise.all(
                    keys.map(function (key) {
                        if (key !== CACHE_NAME) {
                            return caches.delete(key);
                        }
                        return Promise.resolve();
                    })
                );
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

self.addEventListener("fetch", function (event) {
    var request = event.request;

    if (request.method !== "GET") {
        return; /* API 호출은 그대로 통과 */
    }

    var url;
    try {
        url = new URL(request.url);
    } catch (err) {
        return;
    }

    if (url.origin !== self.location.origin || url.pathname.indexOf("/api/") === 0) {
        return;
    }

    /* 영상은 캐시하지 않습니다(2~3MB). 브라우저 기본 캐시에만 맡깁니다. */
    if (/\.(webm|mp4)$/i.test(url.pathname)) {
        return;
    }

    var isNavigation = request.mode === "navigate";

    /* 페이지(HTML)는 네트워크 우선: 새로 배포한 내용이 바로 보입니다.
     * 오프라인일 때만 캐시된 index.html 로 대체합니다. */
    if (isNavigation) {
        event.respondWith(
            fetch(request)
                .then(function (response) {
                    if (response && response.ok) {
                        var copy = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put("./index.html", copy).catch(function () {});
                        });
                    }
                    return response;
                })
                .catch(function () {
                    return caches.match("./index.html");
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(function (cached) {
            if (cached) {
                return cached;
            }
            return fetch(request)
                .then(function (response) {
                    if (response && response.ok) {
                        var copy = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(request, copy).catch(function () {});
                        });
                    }
                    return response;
                })
                .catch(function () {
                    return new Response("", { status: 504, statusText: "offline" });
                });
        })
    );
});
