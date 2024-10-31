//-----------------Global Variables-----------------
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(deepCopy);
    }

    const copy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}
//----------End Global Variables----------

//-------------------Logging Functions-------------------
function log(message) {
    var type = message.type;
    message.type = 'log_' + type;
    message.content = '[Service Worker] ' + message.content;
    if (type === 'error') {
        console.error(message.content);
    }
    else {
        console.log(message.content);
    }
}
//-----------------End Logging Functions-----------------
async function fetchAuthorizationFromSessionStorage() {
    authorization = await new Promise((resolve, reject) => {
        chrome.storage.session.get(['authorization'], (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result.authorization);
        });
    });
    return ({
        message: "Authorization Fetched",
        success: true,
        object: authorization
    });
};

async function fetchWebExperimentConfig(experimentID, authorization) {
    try {

        const myHeaders = new Headers();
        myHeaders.append("accept", "application/json");
        myHeaders.append("authorization", authorization);
        myHeaders.append("content-type", "application/json");

        const options = {
            method: 'GET',
            headers: myHeaders
        };

        var breakCondition = false;
        log({
            type: 'debug',
            content: 'Fetching Experiment ' + experimentID + ' Config'
        });
        var experimentConfig = await fetch('https://api.optimizely.com/v2/experiments/' + experimentID, options)
            .then(response => {
                if (response.status == 200) {
                    log({
                        type: 'debug',
                        content: 'Experiment ' + experimentID + ' Config Fetched via API'
                    });
                    return (response.json());
                }
                else {
                    log({
                        type: 'error',
                        content: 'Failed to Fetch Experiment ' + experimentID + ' Config via API'
                    });
                    breakCondition = true;
                }
            })
            .then(result => {
                return (result)
            })
            .catch((error) => {
                throw new Error(error);
            });

        if (breakCondition) {
            throw new Error("Failed to Return Experiment " + experimentID + " Config");
        }
        return ({
            message: "Successfully Fetched Experiment " + experimentID + " Config",
            success: true,
            object: experimentConfig
        });
    } catch (error) {
        throw new Error('Error Fetching Experiment Config: ' + error);
    }
};

async function postWebChangeToExperiment(postObject, authorization) {

    try {
        experimentID = postObject.experimentID;
        action = postObject.action;
        body = postObject.body;

        const myHeaders = new Headers();
        myHeaders.append("accept", "application/json");
        myHeaders.append("authorization", authorization);
        myHeaders.append("content-type", "application/json");

        const requestOptions = {
            method: "PATCH",
            headers: myHeaders,
            redirect: "follow",
            body: body
        };

        var response = await fetch("https://api.optimizely.com/v2/experiments/" + experimentID + "?action=" + action, requestOptions)
            .then((response) => {
                if (response.status == 200) {
                    return (response.json());
                }
                else {
                    breakCondition = true;
                }
            })
            .then((result) => {
                return (result);
            })
            .catch((error) => {
                throw new Error(error);
            });

        return ({
            message: "Posting Changes to Experiment " + experimentID + " Successful",
            success: true,
            object: {}
        });
    } catch (error) {
        log({
            type: 'error',
            content: 'Error Posting Changes to Experiment ' + experimentID + ': ' + error
        });
        return {
            message: "Posting Changes to Experiment " + experimentID + " Failed",
            success: false,
            object: {}
        }
    }
};


//-----------------Main Code-----------------
//---------- End Main Code----------

//---------- Worker Functions----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    var experimentID = message.experimentID;

    var pagesStr = message.pages;
    var pages = [];

    pagesStr.forEach(page => {
        pages.push(parseInt(page));
    });

    var allPagesStr = message.allPages;
    var allPages = [];

    allPagesStr.forEach(page => {
        allPages.push(parseInt(page));
    });

    var authorization = fetchAuthorizationFromSessionStorage();
    authorization.then(auth => {
        log({
            type: 'debug',
            content: 'Authorization Fetched: ' + auth.object
        });
        if (auth.success) {
            var experimentConfig = fetchWebExperimentConfig(experimentID, auth.object);
            experimentConfig.then(config => {
                log({
                    type: 'debug',
                    content: 'Experiment Config Fetched: ' + config.object
                });
                if (config.success) {

                    var currentConfig = config.object;

                    var currentStatus = '';
                    //getting current experiment running status
                    if (currentConfig.status === 'not_started' || config.status === 'paused') {
                        currentStatus = 'pause';
                    }
                    else if (currentConfig.status === 'running') {
                        currentStatus = 'resume';
                    }
                    else {
                        currentStatus = 'pause';
                    }
                    //changing the targeting of the experiment from URL Targeting the Page Targeting
                    var changeTargetingSuccess = postWebChangeToExperiment({
                        experimentID: experimentID,
                        action: currentStatus,
                        body: JSON.stringify({
                            "page_ids": allPages
                        })
                    }, auth.object);
                    changeTargetingSuccess.then(response => {
                        if (response.success) {
                            //modifying the config variations
                            if (pages.length == 0) {
                                //no changes to apply to pages
                                sendResponse({
                                    message: 'No Pages Selected',
                                    success: true
                                });
                            }
                            else {
                                currentVariations = currentConfig.variations;
                                console.log(currentVariations);
                                currentVariations.forEach(variation => {
                                    console.log(variation);
                                    if (variation.actions.length == 1) {
                                        currentAction = deepCopy(variation.actions[0]);
                                        delete currentAction.share_link;
                                        currentAction.changes.forEach(change => {
                                            delete change.id;
                                        });
                                        actions = [];

                                        pages.forEach(page => {
                                            currentAction.page_id = page;
                                            actions.push(deepCopy(currentAction));
                                        });
                                        variation.actions = actions;
                                    }
                                    else {
                                        //no changes in variation
                                        log({
                                            type: 'debug',
                                            content: 'No Changes in Variation'
                                        });
                                    }
                                });
                                var changeVariationsSuccess = postWebChangeToExperiment({
                                    experimentID: experimentID,
                                    action: currentStatus,
                                    body: JSON.stringify({
                                        "variations": currentVariations
                                    })
                                }, auth.object);
                                changeVariationsSuccess.then(response => {
                                    if (response.success) {
                                        sendResponse({
                                            message: 'Changes Posted',
                                            success: true
                                        });
                                    }
                                    else {
                                        log({
                                            type: 'error',
                                            content: 'Error Changing Experiment Variations'
                                        });
                                        sendResponse({
                                            message: 'Error Changing Experiment Variations',
                                            success: false
                                        });
                                    }
                                }).catch(error => {
                                    log({
                                        type: 'error',
                                        content: 'Error Changing Experiment Variations: ' + error
                                    });
                                    sendResponse({
                                        message: 'Error Changing Experiment Variations',
                                        success: false
                                    });
                                });
                            }
                        }
                        else {
                            log({
                                type: 'error',
                                content: 'Error Changing Experiment Targeting'
                            });
                            sendResponse({
                                message: 'Error Changing Experiment Targeting',
                                success: false
                            });
                        }
                    }).catch(error => {
                        log({
                            type: 'error',
                            content: 'Error Changing Experiment Targeting: ' + error
                        });
                        sendResponse({
                            message: 'Error Changing Experiment Targeting',
                            success: false
                        });
                    });
                }
                else {
                    sendResponse({
                        message: 'Error Fetching Experiment Config',
                        success: false
                    });
                }
            }).catch(error => {
                log({
                    type: 'error',
                    content: 'Error Fetching Experiment Config: ' + error
                });
                sendResponse({
                    message: 'Error Fetching Experiment Config',
                    success: false
                });
            });
        }
        else {
            sendResponse({
                message: 'Error Fetching Authorization',
                success: false
            });
        }


    }).catch(error => {
        log({
            type: 'error',
            content: 'Error Fetching Authorization: ' + error
        });
        sendResponse({
            message: 'Error Fetching Authorization',
            success: false
        });
    });
    return true;
});
//only is listening for requests to the Optimizely API
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    //if the request is a GET request, it should have an PAT authorization header
    if (details.method == 'GET') {
        log({
            type: 'debug',
            content: 'GET Request to Optimizely API Detected'
        });
        //parse PAT from request
        authorizationHeader = details.requestHeaders.find(item => item.name === "Authorization");
        log({
            type: 'serviceWorker',
            content: 'Authorization Header Found: ' + authorizationHeader.value
        });

        log({
            type: 'debug',
            content: 'Checking Session Storage for Authorization'
        });
        chrome.storage.session.get(['authorization'], function (result) {
            if (result.authorization) {
                log({
                    type: 'debug',
                    content: 'Authorization Found in Session Storage'
                });
                if (result.authorization = authorizationHeader.value) {
                    log({
                        type: 'debug',
                        content: 'Found Authorization Matches Stored Value, Skipping...'
                    });
                }
                else {
                    try {
                        chrome.storage.session.set({ "authorization": authorizationHeader.value }, function () {
                            log({
                                type: 'debug',
                                content: 'Authorization Updated in Session Storage'
                            });
                        });
                    } catch (error) {
                        log({
                            type: 'error',
                            content: 'Error Saving Authorization to Session Storage: ' + error
                        });
                    }
                }
            } else {
                log({
                    type: 'debug',
                    content: 'No Authorization Found in Session Storage, Saving...'
                });
                try {
                    chrome.storage.session.set({ "authorization": authorizationHeader.value }, function () {
                        log({
                            type: 'debug',
                            content: 'Authorization Saved to Session Storage'
                        });
                    });
                } catch (error) {
                    log({
                        type: 'error',
                        content: 'Error Saving Authorization to Session Storage: ' + error
                    });

                }
            }
        });

    }
    else {
        log({
            type: 'debug',
            content: 'Non-GET Request to Optimizely API Detected'
        });
    }
},
    { urls: ["https://api.app.optimizely.com/*"] },
    ["requestHeaders"]
);
//---------- End Worker Functions----------

//-----------------Main Code-----------------
//executes when the script is loaded
console.log("Service Worker Loaded");

