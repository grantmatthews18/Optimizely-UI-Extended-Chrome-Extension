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
    if (type === 'error') {
        console.error('[Service Worker]', message.content);
    }
    else {
        console.log('[Service Worker]', message.content);
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

    if (authorization) {
        return ({
            message: "Authorization Fetched",
            success: true,
            object: authorization
        });
    }
    else {
        return ({
            message: "Authorization Not Found",
            success: false,
            object: {}
        });
    }
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
//Message Listener for messages from the page. 
//This is where the page tells the extension what to do.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    log({
        type: 'debug',
        content: 'Message Received: ' + message
    });

    //collecting variables from the message
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

    log({
        type: 'debug',
        content: 'Fetched Message Details Experiment ID: ' + experimentID
    });

    //Main Code Block
    //each step needs to complete successfully, if a step fails, reverse the changes made in the previous steps and tell the page

    //getting the authorization from session storage
    var authorization = fetchAuthorizationFromSessionStorage();
    authorization.then(auth => {
        //authorization fetched
        if (auth.success) {
            //authorization fetched successfully
            log({
                type: 'debug',
                content: 'Authorization Fetched: ' + auth.object
            });

            //fetching the experiment config from the Optimizely REST API
            var experimentConfig = fetchWebExperimentConfig(experimentID, auth.object);
            experimentConfig.then(config => {
                //config fetched
                if (config.success) {
                    //config fetched successfully

                    log({
                        type: 'debug',
                        content: 'Experiment Config Fetched: ' + config.object
                    });

                    var currentConfig = config.object;

                    //getting the current status of the experiment so the state of the experiment doesn't change when transfering changes
                    var currentStatus = '';
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
                        //checking to make sure the targeting change was successful
                        
                        if (response.success) {
                            //modifying the config variations
                            if (pages.length == 0) {
                                //no changes to apply to pages

                                log({
                                    type: 'debug',
                                    content: 'No Page Rules Selected to transfer changes to'
                                });

                                sendResponse({
                                    message: 'No Page Rules Selected to transfer changes to',
                                    success: true
                                });
                            }
                            else {
                                //changes to apply to pages

                                //getting current variations changes
                                currentVariations = currentConfig.variations;

                                currentVariations.forEach(variation => {
                                    //adding the changes from each variation to the pages selected

                                    log({
                                        type: 'debug',
                                        content: 'Transferring Changes from Variation ' + variation.id + ' to Pages'
                                    });

                                    //variation will have only one action array since it was configured for URL targeting
                                    if (variation.actions.length == 1) {
                                        //copying the actions array and adding it back to the changes for each specified page rule
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
                                            content: 'No Changes in Variation ' + variation.id
                                        });
                                    }
                                });

                                log({
                                    type: 'debug',
                                    content: 'Posting Changes to Experiment ' + experimentID
                                });

                                //sending the changes back to the experiment
                                var changeVariationsSuccess = postWebChangeToExperiment({
                                    experimentID: experimentID,
                                    action: currentStatus,
                                    body: JSON.stringify({
                                        "variations": currentVariations
                                    })
                                }, auth.object);
                                changeVariationsSuccess.then(response => {
                                    if (response.success) {

                                        log({
                                            type: 'debug',
                                            content: 'Changes Transfered'
                                        });

                                        sendResponse({
                                            message: 'Changes Transfered',
                                            success: true
                                        });
                                    }
                                    else {

                                        log({
                                            type: 'error',
                                            content: 'Error Transfering Experiment Changes: ' + response.message
                                        });

                                        sendResponse({
                                            message: response.message,
                                            success: false
                                        });
                                    }
                                }).catch(error => {

                                    log({
                                        type: 'error',
                                        content: 'Error Transfering Experiment Changes: ' + error
                                    });

                                    sendResponse({
                                        message: error,
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
                                message: response.message,
                                success: false
                            });
                        }
                        log({
                            type: 'debug',
                            content: 'Experiment Targeting Updated'
                        });
                    }).catch(error => {
                        log({
                            type: 'error',
                            content: 'Error Changing Experiment Targeting: ' + error
                        });
                        sendResponse({
                            message: error,
                            success: false
                        });
                    });
                }
                else {
                    //config fetch failed
                    log({
                        type: 'error',
                        content: 'Error Fetching Experiment Config: ' + config.message
                    });

                    sendResponse({
                        message: config.message,
                        success: false
                    });
                }
            }).catch(error => {
                //fetching the experiment configuration returned an error

                log({
                    type: 'error',
                    content: 'Error Fetching Experiment Config: ' + error
                });

                sendResponse({
                    message: error,
                    success: false
                });
            });
        }
        else {
            //fetchAuthorizationFromSessionStorage returned a value but it wasn't successful

            log({
                type: 'error',
                content: 'Error Fetching Authorization'
            });
            sendResponse({
                message: `
                    Error Fetching Authorization\n
                    This Extension Requires a Personal Access Token to Access the Optimizely API. The Extension scrapes network requests made by the Optimizely Web App to get a Personal Access Token (For more Information, see Extension Documentation).\n
                    Please Visit a Page in the Web App that triggers a REST API Request (documentation) or Provide a Personal Access Token in the Extension Options Page (Coming Soon)\n`,
                success: false
            });

            console.log('Now Im here');

            return false;
        }
    }).catch(error => {
        //fetchAuthorizationFromSessionStorage returned an error

        log({
            type: 'error',
            content: 'Error Fetching Authorization: ' + error
        });
        sendResponse({
            message: `
                Error Fetching Authorization\n
                This Extension Requires a Personal Access Token to Access the Optimizely API. The Extension scrapes network requests made by the Optimizely Web App to get a Personal Access Token (For more Information, see Extension Documentation)\n
                Please Visit a Page in the Web App that triggers a REST API Request (documentation) or Provide a Personal Access Token in the Extension Options Page (Coming Soon)\n`,
            success: false
        });

        return false;
    });

    //tells the page to wait for a response
    return true;
});

//Listens for requests to the Optimizely API. Saves the PAToken from the request to session storage
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    //if the request is a GET request, it should have an PAT authorization header
    if (details.method == 'GET') {
        //get request to Optimizely API detected
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

        //store PAT in session storage if no PAT exists
        //update PAT in session storage if PAT is different
        //do nothing if PAT already exists
        chrome.storage.session.get(['authorization'], function (result) {
            //true if authorization exists in session storage
            if (result.authorization) {
                //authorization found in session storage
                log({
                    type: 'debug',
                    content: 'Authorization Found in Session Storage'
                });

                //checking if authorization matches existing stored value
                if (result.authorization = authorizationHeader.value) {
                    //found authorization matches existing stored value
                    log({
                        type: 'debug',
                        content: 'Found Authorization Matches Stored Value, Skipping...'
                    });
                }
                else {
                    //found authorziation does not match existing stored value. updating value
                    try {
                        //updating authorization in session storage
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
                //authorization not found in session storage
                log({
                    type: 'debug',
                    content: 'No Authorization Found in Session Storage, Saving...'
                });

                //saving authorization in session storage
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
        //non-GET request to Optimizely API detected
        //this should not happen based on my understanding of the platform
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

