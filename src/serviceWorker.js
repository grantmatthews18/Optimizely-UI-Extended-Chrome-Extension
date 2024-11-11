//-----------------Global Variables and Functions-----------------
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

async function fetchFeaturesFromStorage() {
    try {

        log({
            type: 'debug',
            content: 'Fetching Features'
        });

        const features = new Promise((resolve, reject) => {
            chrome.storage.local.get(['enabledFeatures'], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(result.enabledFeatures);
            });
        });

        const featuresObject = await features;

        log({
            type: 'debug',
            content: featuresObject ? ('Features Found: ', featuresObject) : 'Features Not Found'
        });

        return ({
            message: "Features Fetched",
            success: true,
            object: featuresObject
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Features: ', error)
        });
        return {
            message: 'Error Fetching Features',
            success: false,
            object: {}
        };
    }
};

async function fetchAuthorizationFromStorage() {
    log({
        type: 'debug',
        content: 'Fetching Authorization'
    });

    const localAuthorization = new Promise((resolve, reject) => {
        chrome.storage.local.get(['authorizationUser'], (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result.authorizationUser);
        });
    });

    const sessionAuthorization = new Promise((resolve, reject) => {
        chrome.storage.session.get(['authorizationScraped'], (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result.authorizationScraped);
        });
    });

    const [storedAuth, scrapedAuth] = await Promise.all([localAuthorization, sessionAuthorization]);

    log({
        type: 'debug',
        content: storedAuth ? ('Stored Authorization Found', storedAuth) : 'Stored Authorization Not Found'
    });
    log({
        type: 'debug',
        content: scrapedAuth ? ('Scraped Authorization Found', scrapedAuth) : 'Scraped Authorization Not Found'
    });

    if (storedAuth || scrapedAuth) {
        return ({
            stored: storedAuth,
            scraped: scrapedAuth
        });
    }
    else {
        throw new Error('Stored and Scraped Authorization Not Found');
    }
};

async function fetchWebExperimentConfig(experimentID, authorization) {
    const myHeaders = new Headers();
    myHeaders.append("accept", "application/json");
    myHeaders.append("authorization", authorization);
    myHeaders.append("content-type", "application/json");

    const options = {
        method: 'GET',
        headers: myHeaders
    };

    log({
        type: 'debug',
        content: 'Fetching Experiment ' + experimentID + ' Config'
    });

    var response = await fetch('https://api.optimizely.com/v2/experiments/' + experimentID, options)

    if (response.status == 200) {
        log({
            type: 'debug',
            content: ('Experiment ' + experimentID + ' Config Fetched via API: ', response)
        });
        return (response.json());
    }
    else {
        throw new Error(('Failed to Fetch Experiment ' + experimentID + ' Config via API', response));
    }
};

async function fetchPageConfig(pageID, authorization) {
    const myHeaders = new Headers();
    myHeaders.append("accept", "application/json");
    myHeaders.append("authorization", authorization);
    myHeaders.append("content-type", "application/json");

    const options = {
        method: 'GET',
        headers: myHeaders
    };

    log({
        type: 'debug',
        content: 'Fetching Page ' + pageID + ' Config'
    });

    var response = await fetch('https://api.optimizely.com/v2/pages/' + pageID, options);

    if (response.status == 200) {
        log({
            type: 'debug',
            content: ('Page ' + pageID + ' Config Fetched via API: ', response)
        });
        return (response.json());
    }
    else {
        throw new Error(('Failed to Fetch Page ' + pageID + ' Config via API', response));
    }
};

async function postWebChangeToExperiment(postObject, authorization) {
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

    if (response.status == 200) {
        log({
            type: 'debug',
            content: ('Changes Posted to Experiment ' + experimentID + ': ', response)
        });
        return (response.json());
    }
    else {
        throw new Error("Failed to Post Changes to Experiment " + experimentID + ": " + response);
    }
};
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

//

//----------------- Extension Functions -----------------

async function exportVariationChanges(message, sender, sendResponse) {

    //parsing message content for needed information
    try {
        log({
            type: 'debug',
            content: ('Parsing Message Content: ', message)
        });

        //collecting variables from the message
        var experimentID = message.experimentID;
        var variationID = message.variationID;
        var firstChangeID = message.firstChangeID;
        var requestedChanges = message.requestedChanges;
    } catch (error) {
        log({
            type: 'error',
            content: ('Parsing Message Content: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //Main Code Block
    //each step needs to complete successfully, if a step fails, reverse the changes made in the previous steps and tell the page

    //getting the authorization from session storage
    try {

        log({
            type: 'debug',
            content: 'Fetching Authorization'
        });

        var [authorization, features] = await Promise.all([fetchAuthorizationFromStorage(), fetchFeaturesFromStorage()]);

        if (authorization && features) {
            log({
                type: 'debug',
                content: ('Authorization Fetched: ', authorization)
            });
        }
        else {
            throw new Error(authorization ? 'Features Not Found in Local Storage' : 'Authorization Not Found in Local or Session Storage');;
        };


    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Authorization: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //fetching the experiment config from the Optimizely REST API
    //also checking if the stored token is valid
    try {

        log({
            type: 'debug',
            content: 'Fetching Experiment Config'
        });

        var useScrape = features.prioritizeScrape;
        var experimentConfig;
        var sentResponse = false;

        if (features.prioritizeScrape) {
            try {
                experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.scraped);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Scraped Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                log({
                    type: 'info',
                    content: ('Error Fetching Experiment Config via Scraped Token: ', error)
                });
                log({
                    type: 'debug',
                    content: 'Attempting to Fetch Experiment Config via Stored Token'
                });
                useScrape = false;
                try {
                    experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                    if (experimentConfig) {
                        log({
                            type: 'debug',
                            content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                        });
                    }
                } catch (error) {
                    sentResponse = true;
                    sendResponse({
                        message:
                            'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                        success: false
                    });
                    throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
                }
            }
        }
        else {
            try {
                var experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                sendResponse = true;
                sendResponse({
                    message:
                        'Error Fetching Authorization. Stored Token is inavlid for this account. You\'ve indicated that the extension should use the stored Personal Access Token to Access the Optimizely API. Please disable use of the stored token or provide a valid Personal Access Token for this account.',
                    success: false
                });
                throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
            }
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Experiment Config: ', error)
        });
        if (!sentResponse) {
            sendResponse({
                message: error,
                success: false
            });
        }
        return false;
    }

    //collecting changes to export
    try {
        log({
            type: 'debug',
            content: ('Collecting Changes to Export: ', requestedChanges, 'from Variation ', variationID)
        });

        var foundAction = false;
        var changesExport = [];

        //iterating through the variations to find the anchor change firstChangeID
        //if the change is found, we know that is the correct page to export the changes too. Export the changes from that page
        for(const variation of experimentConfig.variations) {
            if(variation.variation_id == variationID) {
                for(const action of variation.actions) {
                    for(const change of action.changes) {
                        if(change.id.includes(firstChangeID)) {
                            foundAction = true;
                            break;
                        }
                    }

                    //send the changes back to the page
                    if(foundAction) {
                        log({
                            type: 'info',
                            content: 'Found Changes on Page ID ' + action.page_id + ', Sending Back to Page...'
                        });

                        for(const change of action.changes) {
                            if(requestedChanges.includes(change.id)) {
                                changesExport.push(change);
                            }
                        }
                        break;
                    }
                }
            }

            if(foundAction) {
                break;
            }
        };

        if(!foundAction || changesExport.length === 0) {
            throw new Error('Unable to Find Changes from Anchor Change');
        }

    }
    catch (error) {
        log({
            type: 'error',
            content: ('Error Collecting Changes to Export: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //sending the changes back to the page
    try {
        log({
            type: 'debug',
            content: ('Sending Changes Back to Page: ', changesExport)
        });
        sendResponse({
            message: changesExport,
            success: true
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Sending Changes Back to Page: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    };
};

function oldExportVariationChanges(message, sender, sendResponse) {
    //collecting variables from the message
    var experimentID = message.experimentID;
    var variationID = message.variationID;
    var firstChangeID = message.firstChangeID;
    var requestedChanges = message.requestedChanges;

    log({
        type: 'debug',
        content: 'Fetched Message Details Experiment ID: ' + experimentID
    });

    var authorization = fetchAuthorizationFromStorage();
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
                    var foundAction = false;
                    var sentMessage = false;

                    //iterating through the variations to find the anchor change firstChangeID
                    //if the change is found, we know that is the correct page to export the changes too. Export the changes from that page
                    currentConfig.variations.forEach(variation => {
                        if (variation.variation_id == variationID) {
                            variation.actions.forEach(action => {
                                foundAction = false;
                                action.changes.forEach(change => {
                                    if (change.id.includes(firstChangeID)) {
                                        foundAction = true;
                                        return false;
                                    }
                                });

                                //send the changes back to the page
                                if (foundAction) {

                                    log({
                                        type: 'info',
                                        content: 'Found Changes, Sending Back to Page...'
                                    });

                                    var changesExport = [];
                                    action.changes.forEach(change => {
                                        if (requestedChanges.includes(change.id)) {
                                            changesExport.push(change);
                                        }
                                    });

                                    sendResponse({
                                        message: changesExport,
                                        success: true
                                    });

                                    sentMessage = true;

                                    return false;
                                }
                            });

                            if (foundAction) {
                                return false;
                            }
                        }
                    });

                    if (!sentMessage) {
                        //unable to find a page with a matching change to the anchor change
                        log({
                            type: 'error',
                            content: 'Unable to Find Changes from Anchor Change'
                        });

                        sendResponse({
                            message: 'Unable to Find Changes from Anchor Change',
                            success: false
                        });
                    }
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
            //fetchAuthorizationFromStorage returned a value but it wasn't successful

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

            return false;
        }
    }).catch(error => {
        //fetchAuthorizationFromStorage returned an error

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
};

//helper function to find the page ID(s) to import changes to for the import function
//needs to exists because there is no way to scrape the current page ID from the app UI so we need to guess based on the information available
async function findPageIDs(experimentConfig, variationID, type, matchContent, authorization) {
    if (type === 'id') {
        var firstChangeID = matchContent;
        //iterating through the variations to find the anchor change firstChangeID
        //if the change is found, we know that is the correct page to export the changes too. Export the changes from that page

        for (const variation of experimentConfig.variations) {
            if (variation.variation_id == variationID) {
                for (const action of variation.actions) {
                    var foundAction = false;
                    for (const change of action.changes) {
                        if (change.id.includes(firstChangeID)) {
                            foundAction = true;
                            break;
                        }
                    }

                    //send the changes back to the page
                    if (foundAction) {

                        log({
                            type: 'debug',
                            content: 'Using Change ID ' + firstChangeID + ', Found Page ID Match: ' + action.page_id
                        });

                        return ([action.page_id]);
                    }
                }
            }
        }
        throw new Error('Unable to Find Changes from Anchor Change');
    }
    else {
        matchedPageIDs = [];

        // Create an array of promises
        const promises = experimentConfig.page_ids.map(async function (pageID) {
            var pageConfig = await fetchPageConfig(pageID, authorization);

            if (type === 'name' && pageConfig.object.name === matchContent.name) {
                matchedPageIDs.push(pageID);
            } else if (type === 'url' && pageConfig.object.edit_url === matchContent.url) {
                matchedPageIDs.push(pageID);
            } else if (type === 'pageAndURL' && pageConfig.object.name === matchContent.name && pageConfig.object.edit_url === matchContent.url) {
                matchedPageIDs.push(pageID);
            } else if (type === 'all' && pageConfig.object.name === matchContent.name && pageConfig.object.edit_url === matchContent.url) {
                matchedPageIDs.push(pageID);
            }
        });

        await Promise.all(promises);

        if (matchedPageIDs.length === 0) {
            throw new Error('No Page IDs Found');
        }
        else {
            log({
                type: 'debug',
                content: ('Matched ' + matchedPageIDs.length + ' Page(s)', matchedPageIDs)
            });
            return matchedPageIDs;
        }
    }
};

async function importVariationChanges(message, sender, sendResponse) {

    try {
        log({
            type: 'debug',
            content: ('Parsing Message Content: ', message)
        });

        //collecting variables from the message
        var experimentID = message.experimentID;
        var variationID = parseInt(message.variationID, 10);
        var importedChanges = message.changes;
        var matchContent = message.matchContent;

        log({
            type: 'debug',
            content: ('Message Parsed: Importing Changes ', message.changes, 'to ' + variationID + ' of experiment ' + experimentID + '(yet to find page ID)')
        });

    } catch (error) {
        log({
            type: 'error',
            content: ('Parsing Message Content: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //Main Code Block
    //each step needs to complete successfully, if a step fails, reverse the changes made in the previous steps and tell the page

    //getting the authorization from session storage
    try {

        log({
            type: 'debug',
            content: 'Fetching Authorization'
        });

        var [authorization, features] = await Promise.all([fetchAuthorizationFromStorage(), fetchFeaturesFromStorage()]);

        if (authorization && features) {
            log({
                type: 'debug',
                content: ('Authorization Fetched: ', authorization)
            });
        }
        else {
            throw new Error(authorization ? 'Features Not Found in Local Storage' : 'Authorization Not Found in Local or Session Storage');;
        };


    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Authorization: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //fetching the experiment config from the Optimizely REST API
    //also checking if the stored token is valid
    try {

        log({
            type: 'debug',
            content: 'Fetching Experiment Config'
        });

        var useScrape = features.prioritizeScrape;
        var experimentConfig;
        var sentResponse = false;

        if (features.prioritizeScrape) {
            try {
                experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.scraped);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Scraped Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                log({
                    type: 'info',
                    content: ('Error Fetching Experiment Config via Scraped Token: ', error)
                });
                log({
                    type: 'debug',
                    content: 'Attempting to Fetch Experiment Config via Stored Token'
                });
                useScrape = false;
                try {
                    experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                    if (experimentConfig) {
                        log({
                            type: 'debug',
                            content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                        });
                    }
                } catch (error) {
                    sentResponse = true;
                    sendResponse({
                        message:
                            'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                        success: false
                    });
                    throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
                }
            }
        }
        else {
            try {
                var experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                sendResponse = true;
                sendResponse({
                    message:
                        'Error Fetching Authorization. Stored Token is inavlid for this account. You\'ve indicated that the extension should use the stored Personal Access Token to Access the Optimizely API. Please disable use of the stored token or provide a valid Personal Access Token for this account.',
                    success: false
                });
                throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
            }
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Experiment Config: ', error)
        });
        if (!sentResponse) {
            sendResponse({
                message: error,
                success: false
            });
        }
        return false;
    }

    //finding the page ID(s) to import the changes to
    try {
        log({
            type: 'debug',
            content: ('Finding Page ID to Import Changes by matching via ' + message.type.split('-')[1] + ' based on: ', matchContent)
        });

        //getting page ID(s) where the changes will be imported
        var pageIDs = await findPageIDs(experimentConfig, variationID, message.type.split('-')[1], matchContent, useScrape ? authorization.scraped : authorization.stored);
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Finding Page ID to Import Changes: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //adding changes to variation
    try {
        log({
            type: 'debug',
            content: ('Importing Changes ', importedChanges, ' to Variation ' + variationID + ' on Page IDs: ', pageIDs)
        });

        //modifying the imported changes to remove the change ID
        //the change ID isn't needed and could interfere and cause issues if changes are imported on top of each other
        //to simplfy things, we'll let the API reassign new change IDs
        var importedChanges = message.changes;
        importedChanges.forEach(change => {
            delete change.id;
        });

        //extracting the variations object from the experiment config
        var variationsConfig = experimentConfig.variations;

        var appledChanges = false;

        for (const variation of variationsConfig) {
            for (const action of variation.actions) {
                delete action.share_link;
                if (variation.variation_id === variationID && pageIDs.includes(action.page_id)) {
                    //found the variation to import the changes to
                    //adding the changes to the variation
                    action.changes = action.changes.concat(importedChanges);
                    appledChanges = true;
                    break
                }
            }
            if (appledChanges) {
                break;
            }
        }

        if (!appledChanges) {
            throw new Error(('Page ID(s) ', pageIDs, ' Not Found in Variation ' + variationID));
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Importing Changes to Variation: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //getting current status of the experiment
    try {

        log({
            type: 'debug',
            content: 'Getting Current Experiment Status'
        });

        var currentStatus = '';
        if (experimentConfig.status === 'not_started' || experimentConfig.status === 'paused') {
            currentStatus = 'pause';
        }
        else if (experimentConfig.status === 'running') {
            currentStatus = 'resume';
        }
        else {
            currentStatus = 'pause';
        }

        log({
            type: 'debug',
            content: 'Current Experiment Status: ' + currentStatus
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Getting Current Experiment Status: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //posting the changes back to the experiment
    try {
        //posting the changes back to the experiment
        await postWebChangeToExperiment({
            experimentID: experimentID,
            action: currentStatus,
            body: JSON.stringify({
                "variations": variationsConfig
            })
        }, useScrape ? authorization.scraped : authorization.stored);

        log({
            type: 'debug',
            content: 'Changes Imported'
        });
        sendResponse({
            message: 'Changes Imported',
            success: true
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Posting Changes to Experiment: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }
};

function oldImportVariationChanges(message, sender, sendResponse) {
    log({
        type: 'debug',
        content: 'Fetched Message Details Experiment ID: ' + experimentID
    });

    var authorization = fetchAuthorizationFromStorage();
    authorization.then(auth => {
        //authorization fetched
        if (auth.success) {
            //authorization fetched successfully
            log({
                type: 'debug',
                content: ('Authorization Fetched: ', auth.object)
            });

            //fetching the experiment config from the Optimizely REST API
            var experimentConfig = fetchWebExperimentConfig(experimentID, auth.object);
            experimentConfig.then(config => {
                //config fetched
                if (config.success) {
                    //config fetched successfully

                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched: ', config.object)
                    });

                    //getting page ID(s) where the changes will be imported
                    var pageIDs = findPageIDs(config.object, variationID, message.type.split('-')[1], message.matchContent, auth.object);
                    pageIDs.then(pages => {
                        //page IDs fetched
                        if (pages.success) {
                            //page IDs fetched successfully

                            log({
                                type: 'debug',
                                content: ('Page IDs Fetched: ', pages.object)
                            });

                            //modifying the imported changes to remove the change ID
                            //the change ID isn't needed and could interfere and cause issues if changes are imported on top of each other
                            //to simplfy things, we'll let the API reassign new change IDs
                            var importedChanges = message.changes;
                            importedChanges.forEach(change => {
                                delete change.id;
                            });

                            //extracting the variations object from the experiment config
                            var variationsConfig = config.object.variations;

                            //iterating through the variations to find the variation to import the changes to
                            variationsConfig.forEach(variation => {
                                //we do two things here
                                //1. delete the share_link property from the all the action objects across both variations
                                //2. add the imported changes to the action object of the varition and page we want to import the changes to

                                variation.actions.forEach(action => {
                                    delete action.share_link;

                                    if (variation.variation_id === variationID && pages.object.includes(action.page_id)) {
                                        //found the variation to import the changes to
                                        //adding the changes to the variation
                                        action.changes = action.changes.concat(importedChanges);
                                    }
                                });
                            });

                            log({
                                type: 'debug',
                                content: ('Variation Object Created', variationsConfig)
                            });

                            //getting the current status of the experiment so the state of the experiment doesn't change when transfering changes
                            var currentStatus = '';
                            if (config.object.status === 'not_started' || config.object.status === 'paused') {
                                currentStatus = 'pause';
                            }
                            else if (config.object.status === 'running') {
                                currentStatus = 'resume';
                            }
                            else {
                                currentStatus = 'pause';
                            }

                            log({
                                type: 'debug',
                                content: ('Posting Changes to Experiment ', experimentID)
                            });

                            //posting the changes back to the experiment
                            var changeVariationsSuccess = postWebChangeToExperiment({
                                experimentID: experimentID,
                                action: currentStatus,
                                body: JSON.stringify({
                                    "variations": variationsConfig
                                })
                            }, auth.object);
                            changeVariationsSuccess.then(response => {
                                //checking to make sure the changes were posted successfully
                                if (response.success) {
                                    log({
                                        type: 'debug',
                                        content: 'Changes Imported'
                                    });

                                    sendResponse({
                                        message: 'Changes Imported',
                                        success: true
                                    });
                                }
                                else {
                                    log({
                                        type: 'error',
                                        content: 'Error Importing Experiment Changes: ' + response.message
                                    });

                                    sendResponse({
                                        message: response.message,
                                        success: false
                                    });
                                }
                            }).catch(error => {

                                log({
                                    type: 'error',
                                    content: 'Error Importing Experiment Changes: ' + error
                                });

                                sendResponse({
                                    message: error,
                                    success: false
                                });
                            });
                        }
                        else {
                            //page IDs fetch failed
                            log({
                                type: 'error',
                                content: ('Error Fetching Page IDs: ', pages.message)
                            });

                            sendResponse({
                                message: pages.message,
                                success: false
                            });
                        }
                    }).catch(error => {
                        //fetching the page IDs returned an error
                        log({
                            type: 'error',
                            content: ('Error Fetching Page IDs: ', error)
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
                        content: ('Error Fetching Experiment Config: ', config.message)
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
                    content: ('Error Fetching Experiment Config: ', error)
                });

                sendResponse({
                    message: error,
                    success: false
                });
            });
        }
        else {
            //fetchAuthorizationFromStorage returned a value but it wasn't successful

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

            return false;
        }
    }).catch(error => {
        //fetchAuthorizationFromStorage returned an error

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
};

async function deleteVariationChanges(message, sender, sendResponse) {

    //parsing message content for needed information 
    try {
        log({
            type: 'debug',
            content: ('Parsing Message Content: ', message)
        });

        var experimentID = message.experimentID;
        var variationID = message.variationID;
        var firstChangeID = message.firstChangeID;
        var requestedChanges = message.requestedChanges;

        log({
            type: 'debug',
            content: ('Message Parsed: Deleting Changes in ' + variationID + ' of experiment ' + experimentID + ': ', requestedChanges)
        });
    } catch (error) {
        log({
            type: 'error',
            content: 'Parsing Message Content: ' + error
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //Main Code Block
    //each step needs to complete successfully, if a step fails, reverse the changes made in the previous steps and tell the page

    //getting the authorization from session storage
    try {

        log({
            type: 'debug',
            content: 'Fetching Authorization'
        });

        var [authorization, features] = await Promise.all([fetchAuthorizationFromStorage(), fetchFeaturesFromStorage()]);

        if (authorization && features) {
            log({
                type: 'debug',
                content: ('Authorization Fetched: ', authorization)
            });
        }
        else {
            throw new Error(authorization ? 'Features Not Found in Local Storage' : 'Authorization Not Found in Local or Session Storage');;
        };


    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Authorization: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //fetching the experiment config from the Optimizely REST API
    //also checking if the stored token is valid
    try {

        log({
            type: 'debug',
            content: 'Fetching Experiment Config'
        });

        var useScrape = features.prioritizeScrape;
        var experimentConfig;
        var sentResponse = false;

        if (features.prioritizeScrape) {
            try {
                experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.scraped);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Scraped Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                log({
                    type: 'info',
                    content: ('Error Fetching Experiment Config via Scraped Token: ', error)
                });
                log({
                    type: 'debug',
                    content: 'Attempting to Fetch Experiment Config via Stored Token'
                });
                useScrape = false;
                try {
                    experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                    if (experimentConfig) {
                        log({
                            type: 'debug',
                            content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                        });
                    }
                } catch (error) {
                    sentResponse = true;
                    sendResponse({
                        message:
                            'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                        success: false
                    });
                    throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
                }
            }
        }
        else {
            try {
                var experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                sendResponse = true;
                sendResponse({
                    message:
                        'Error Fetching Authorization. Stored Token is inavlid for this account. You\'ve indicated that the extension should use the stored Personal Access Token to Access the Optimizely API. Please disable use of the stored token or provide a valid Personal Access Token for this account.',
                    success: false
                });
                throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
            }
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Experiment Config: ', error)
        });
        if (!sentResponse) {
            sendResponse({
                message: error,
                success: false
            });
        }
        return false;
    }

    //modifying the variations to remove the requested changes
    try {

        log({
            type: 'debug',
            content: 'Modifying Variations'
        });

        var foundAction = false;

        //iterating through the variations to find the anchor change firstChangeID
        //if the change is found, we know that is the correct page to export the changes too. Export the changes from that page
        for (const variation of experimentConfig.variations) {
            if (variation.variation_id == variationID) {
                for (const action of variation.actions) {
                    for (const change of action.changes) {
                        if (change.id.includes(firstChangeID)) {
                            foundAction = true;
                            break;
                        }
                    }

                    if (foundAction) {

                        log({
                            type: 'info',
                            content: 'Linked Change ' + firstChangeID + ' to Page ' + action.page_id + '. Deleting Requested Changes...'
                        });

                        action.changes = action.changes.filter(change => !requestedChanges.includes(change.id));
                        break;
                    }
                }

                if (foundAction) {
                    break;
                }
            }

            if (foundAction) {
                break;
            }
        }

        if (foundAction) {
            log({
                type: 'debug',
                content: 'Changes Deleted'
            });
        }
        else {
            throw new Error('Unable to Find Changes from Anchor Change');
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Modifing Variaitons (Deleting Changes): ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //getting current status of the experiment
    try {

        log({
            type: 'debug',
            content: 'Getting Current Experiment Status'
        });

        var currentStatus = '';
        if (experimentConfig.status === 'not_started' || experimentConfig.status === 'paused') {
            currentStatus = 'pause';
        }
        else if (experimentConfig.status === 'running') {
            currentStatus = 'resume';
        }
        else {
            currentStatus = 'pause';
        }

        log({
            type: 'debug',
            content: 'Current Experiment Status: ' + currentStatus
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Getting Current Experiment Status: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //posting the changes back to the experiment
    try {

        log({
            type: 'debug',
            content: 'Posting Changes to Experiment'
        });

        //changing the targeting of the experiment from URL Targeting the Page Targeting
        await postWebChangeToExperiment({
            experimentID: experimentID,
            action: currentStatus,
            body: JSON.stringify({
                "variations": experimentConfig.variations
            })
        }, useScrape ? authorization.scraped : authorization.stored);

        log({
            type: 'debug',
            content: 'Changes Posted to Experiment'
        });
        sendResponse({
            message: 'Changes Deleted',
            success: true
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Posting Changes to Experiment: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    return true;
};

function oldDelete() {
    //collecting variables from the message
    var experimentID = message.experimentID;
    var variationID = message.variationID;
    var firstChangeID = message.firstChangeID;
    var requestedChanges = message.requestedChanges;

    log({
        type: 'debug',
        content: 'Fetched Message Details Experiment ID: ' + experimentID
    });

    var authorization = fetchAuthorizationFromStorage();
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

                    //getting the current status of the experiment so the state of the experiment doesn't change when transfering changes
                    var currentStatus = '';
                    if (config.object.status === 'not_started' || config.object.status === 'paused') {
                        currentStatus = 'pause';
                    }
                    else if (config.object.status === 'running') {
                        currentStatus = 'resume';
                    }
                    else {
                        currentStatus = 'pause';
                    }

                    var currentConfig = config.object;
                    var foundAction = false;
                    var sentMessage = false;

                    //iterating through the variations to find the anchor change firstChangeID
                    //if the change is found, we know that is the correct page to export the changes too. Export the changes from that page
                    currentConfig.variations.forEach(variation => {
                        if (variation.variation_id == variationID) {
                            variation.actions.forEach(action => {
                                foundAction = false;
                                action.changes.forEach(change => {
                                    if (change.id.includes(firstChangeID)) {
                                        foundAction = true;
                                        return false;
                                    }
                                });

                                //send the changes back to the page
                                if (foundAction) {

                                    log({
                                        type: 'info',
                                        content: 'Found Changes, Deleting...'
                                    });

                                    action.changes = action.changes.filter(change => !requestedChanges.includes(change.id));

                                    var changeVariationsSuccess = postWebChangeToExperiment({
                                        experimentID: experimentID,
                                        action: currentStatus,
                                        body: JSON.stringify({
                                            "variations": currentConfig.variations
                                        })
                                    }, auth.object);
                                    changeVariationsSuccess.then(response => {
                                        //checking to make sure the changes were posted successfully
                                        if (response.success) {
                                            log({
                                                type: 'debug',
                                                content: 'Changes Deleted'
                                            });

                                            sendResponse({
                                                message: 'Changes Deleted',
                                                success: true
                                            });
                                        }
                                        else {
                                            log({
                                                type: 'error',
                                                content: ('Error Deleting Experiment Changes: ', response.message)
                                            });

                                            sendResponse({
                                                message: response.message,
                                                success: false
                                            });
                                        }
                                    }).catch(error => {

                                        log({
                                            type: 'error',
                                            content: ('Error Deleting Experiment Changes: ', error)
                                        });

                                        sendResponse({
                                            message: error,
                                            success: false
                                        });
                                    });

                                    sentMessage = true;

                                    return false;
                                }
                            });

                            if (foundAction) {
                                return false;
                            }
                        }
                    });

                    if (!sentMessage) {
                        //unable to find a page with a matching change to the anchor change
                        log({
                            type: 'error',
                            content: 'Unable to Find Changes from Anchor Change'
                        });

                        sendResponse({
                            message: 'Unable to Find Changes from Anchor Change',
                            success: false
                        });
                    }
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
            //fetchAuthorizationFromStorage returned a value but it wasn't successful

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

            return false;
        }
    }).catch(error => {
        //fetchAuthorizationFromStorage returned an error

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
};

async function transferChanges(message, sender, sendResponse) {

    //parsing message content for needed information 
    try {
        log({
            type: 'debug',
            content: ('Parsing Message Content: ', message)
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
            content: ('Message Parsed: Transfering Changes in ' + experimentID + ' to Pages: ', pages)
        });

    } catch (error) {
        log({
            type: 'error',
            content: 'Parsing Message Content: ' + error
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    };

    //Main Code Block
    //each step needs to complete successfully, if a step fails, reverse the changes made in the previous steps and tell the page

    //getting the authorization from session storage
    try {

        log({
            type: 'debug',
            content: 'Fetching Authorization'
        });

        var [authorization, features] = await Promise.all([fetchAuthorizationFromStorage(), fetchFeaturesFromStorage()]);

        if (authorization && features) {
            log({
                type: 'debug',
                content: ('Authorization Fetched: ', authorization)
            });
        }
        else {
            throw new Error(authorization ? 'Features Not Found in Local Storage' : 'Authorization Not Found in Local or Session Storage');;
        };


    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Authorization: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //fetching the experiment config from the Optimizely REST API
    //also checking if the stored token is valid
    try {

        log({
            type: 'debug',
            content: 'Fetching Experiment Config'
        });

        var useScrape = features.prioritizeScrape;
        var experimentConfig;
        var sentResponse = false;

        if (features.prioritizeScrape) {
            try {
                experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.scraped);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Scraped Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                log({
                    type: 'info',
                    content: ('Error Fetching Experiment Config via Scraped Token: ', error)
                });
                log({
                    type: 'debug',
                    content: 'Attempting to Fetch Experiment Config via Stored Token'
                });
                useScrape = false;
                try {
                    experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                    if (experimentConfig) {
                        log({
                            type: 'debug',
                            content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                        });
                    }
                } catch (error) {
                    sentResponse = true;
                    sendResponse({
                        message:
                            'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                        success: false
                    });
                    throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
                }
            }
        }
        else {
            try {
                var experimentConfig = await fetchWebExperimentConfig(experimentID, authorization.stored);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Experiment Config Fetched via Stored Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                sendResponse = true;
                sendResponse({
                    message:
                        'Error Fetching Authorization. Stored Token is inavlid for this account. You\'ve indicated that the extension should use the stored Personal Access Token to Access the Optimizely API. Please disable use of the stored token or provide a valid Personal Access Token for this account.',
                    success: false
                });
                throw new Error('Error Fetching Experiment Config via Stored Token: ', error);
            }
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Fetching Experiment Config: ', error)
        });
        if (!sentResponse) {
            sendResponse({
                message: error,
                success: false
            });
        }
        return false;
    }

    //getting current status of the experiment
    try {

        log({
            type: 'debug',
            content: 'Getting Current Experiment Status'
        });

        var currentStatus = '';
        if (experimentConfig.status === 'not_started' || experimentConfig.status === 'paused') {
            currentStatus = 'pause';
        }
        else if (experimentConfig.status === 'running') {
            currentStatus = 'resume';
        }
        else {
            currentStatus = 'pause';
        }

        log({
            type: 'debug',
            content: 'Current Experiment Status: ' + currentStatus
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Getting Current Experiment Status: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //posting the chnage of the targeting in the experiment from URL Targeting the Page Targeting
    try {

        log({
            type: 'debug',
            content: 'Changing Experiment Targeting'
        });

        //changing the targeting of the experiment from URL Targeting the Page Targeting
        await postWebChangeToExperiment({
            experimentID: experimentID,
            action: currentStatus,
            body: JSON.stringify({
                "page_ids": allPages
            })
        }, useScrape ? authorization.scraped : authorization.stored);
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Changing Experiment Targeting: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //modifying the config variations
    try {

        log({
            type: 'debug',
            content: 'Modifying Config Variations'
        });

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
            currentVariations = experimentConfig.variations;

            currentVariations.forEach(variation => {
                //adding the changes from each variation to the pages selected

                log({
                    type: 'debug',
                    content: ('Transferring Changes from Variation ' + variation.id + ' to Pages: ', pages)
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
                content: ('Modified Experiment Varitions: ', currentVariations)
            });
        }
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Modifying Config Variations: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    //posting the changes back to the experiment
    try {

        log({
            type: 'debug',
            content: 'Posting Changes to Experiment ' + experimentID
        });

        //sending the changes back to the experiment
        await postWebChangeToExperiment({
            experimentID: experimentID,
            action: currentStatus,
            body: JSON.stringify({
                "variations": currentVariations
            })
        }, useScrape ? authorization.scraped : authorization.stored);

        log({
            type: 'debug',
            content: 'Changes Transfered'
        });

        sendResponse({
            message: 'Changes Transfered',
            success: true
        });
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Transfering Experiment Changes: ', error)
        });
        sendResponse({
            message: error,
            success: false
        });
        return false;
    }

    return true;
};

function oldTransferChanges() {
    var authorization = fetchAuthorizationFromStorage();
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
                    if (currentConfig.status === 'not_started' || currentConfig.status === 'paused') {
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
            //fetchAuthorizationFromStorage returned a value but it wasn't successful

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

            return false;
        }
    }).catch(error => {
        //fetchAuthorizationFromStorage returned an error

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
};

//---------- End Extension Functions----------

//---------- Worker Functions----------
//Message Listener for messages from the page. 
//This is where the page tells the extension what to do.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    log({
        type: 'debug',
        content: ('Message Received: ', message)
    });

    //get first part of message type for multitype messages
    var messageType = message.type.split('-')[0];

    var actionSuccess = false;

    if (messageType === 'transferChanges') {
        //transfer changes message received
        log({
            type: 'debug',
            content: 'Transfer Changes Message Received'
        });

        //transfer changes
        transferChanges(message, sender, sendResponse);
        return true;
    }

    else if (messageType === 'exportVariationChanges') {
        //export variation changes message received
        log({
            type: 'debug',
            content: 'Export Variation Changes Message Received'
        });

        //export variation changes
        exportVariationChanges(message, sender, sendResponse);
        return true;
    }
    else if (messageType === 'importVariationChanges') {
        //import variation changes message received
        log({
            type: 'debug',
            content: 'Import Variation Changes Message Received'
        });

        //import variation changes
        importVariationChanges(message, sender, sendResponse);
        return true;
    }
    else if (messageType === 'deleteVariationChanges') {
        log({
            type: 'debug',
            content: 'Delete Variation Changes Message Recieved'
        })

        //delete variation changes
        deleteVariationChanges(message, sender, sendResponse);
        return true;
    }
    else {
        //message type not recognized
        log({
            type: 'error',
            content: 'Message Type Not Recognized: ' + message.type
        });

        sendResponse({
            message: 'Message Type Not Recognized',
            success: false
        });
        return false;
    }
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
        chrome.storage.session.get(['authorizationScraped'], function (result) {
            //true if authorization exists in session storage
            if (result.authorizationScraped) {
                //authorization found in session storage
                log({
                    type: 'debug',
                    content: 'Authorization Found in Session Storage'
                });

                //checking if authorization matches existing stored value
                if (result.authorizationScraped == authorizationHeader.value) {
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
                    chrome.storage.session.set({ "authorizationScraped": authorizationHeader.value }, function () {
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
log({
    type: 'info',
    content: 'Service Worker Loaded'
});

//Initially Setting Features to Enabled in local storage
//unlike session storage, local storage persists even after the browser is closed
chrome.storage.local.get(['enabledFeatures'], function (result) {
    //true if authorization exists in session storage

    log({
        type: 'info',
        content: 'Enabling All Features on Extension Install'
    });

    if (result.enabledFeatures) {
        //found enabled features in session storage
        //this should never be true since this runs once when the extension is installed the session storage is empty
        log({
            type: 'debug',
            content: 'Found Enabled Features in Session Storage'
        });

    } else {
        //enabledFeatures not found in local storage
        //enabling all features
        //AS MORE FEATURES ARE ADDED, ADD THEM HERE
        log({
            type: 'debug',
            content: 'Enabling all Features on Extension Install'
        });

        //saving authorization in local storage
        try {
            chrome.storage.local.set({
                "enabledFeatures": {
                    transferChanges: true,
                    importExportDeleteChanges: true,
                    revertChanges: true,
                    prioritizeScrape: false //this feature is disabled by default
                }
            }, function () {
                log({
                    type: 'debug',
                    content: 'Enabled Features Saved to Local Storage'
                });
            });
        } catch (error) {
            log({
                type: 'error',
                content: 'Error Saving Enabled Features to Local Storage: ' + error
            });

        }
    }
});

