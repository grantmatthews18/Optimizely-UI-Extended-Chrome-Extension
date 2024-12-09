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

async function fetchWebHistory(experimentID, projectID, authorization) {

    const myHeaders = new Headers();
    myHeaders.append("accept", "application/json");
    myHeaders.append("authorization", authorization);

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    const baseURL = 'https://api.optimizely.com/v2/changes?all_entities=false&per_page=50&project_id=' + projectID + '&entity=experiment:' + experimentID;
    var changes = []
    var pageNum = 1;

    while (true) {
        let response = await fetch(baseURL + "&page=" + pageNum, requestOptions);

        if (response.status == 200) {
            let result = response.json();
            changes = changes.concat(result);
            pageNum += 1;
        }
        else {
            if (pageNum == 1) {
                throw new Error("Failed to Fetch Experiment History");
            }
            else {
                break;
            }
        };
    };

    if (changes.length <= 0) {
        throw new Error("No Changes Found for Experiment " + experimentID);
    };

    return (changes);
}

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

async function postWebChangeToNewExperiment(postObject, authorization) {

    action = postObject.action;
    body = postObject.body;

    const myHeaders = new Headers();
    myHeaders.append("accept", "application/json");
    myHeaders.append("authorization", authorization);
    myHeaders.append("content-type", "application/json");

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        redirect: "follow",
        body: body
    };

    var response = await fetch("https://api.optimizely.com/v2/experiments?action=publish", requestOptions);

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

}

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
        console.error(message.content);
    }
    else {
        console.log(message.content);
    }
}
//-----------------End Logging Functions-----------------

//

//----------------- Extension Functions -----------------
//Helper Function for revertWebChanges -> deconstructs a variation list into a variationDict
function deconstructWebVariationList(variationsList) {
    var variationsDict = {};

    variationsList.forEach((variation) => {

        variationsDict[variation.variation_id] = variation;

        variationsDict[variation.variation_id].pages = {};

        variation.actions.forEach((page) => {
            var pageId = page.page_id;
            var pageChanges = page.changes;

            var changes = {};

            pageChanges.forEach((change) => {
                changes[change.id] = change;
            });

            variationsDict[variation.variation_id].pages[pageId] = changes;
        });

        delete variationsDict[variation.variation_id].actions;
    });
    return variationsDict;
};

//Helper Function for revertWebChanges -> reconstructs the variationDict into a list readable by the Optimizely API
function reconstructWebVariationDict(variationsDict) {
    var variationsList = [];

    Object.keys(variationsDict).forEach((variationID) => {
        var actionsList = [];
        Object.keys(variationsDict[variationID].pages).forEach((pageID) => {
            var changesList = [];
            Object.keys(variationsDict[variationID].pages[pageID]).forEach((changeID) => {
                changesList.push(variationsDict[variationID].pages[pageID][changeID]);
            });

            var pageAction = {
                page_id: parseInt(pageID, 10),
                changes: changesList
            };

            actionsList.push(pageAction);
        });

        var variation = variationsDict[variationID];
        variation.actions = actionsList;
        delete variation.pages;
        variationsList.push(variation);
    });
    return variationsList;
};

//Helper Function for revertWebChanges -> reverts a single web experiment change
function revertWebChange(propertyDict, changeObj) {

    log({
        type: 'debug',
        content: 'Reverting Change ' + changeObj.id
    });
    //iterate over each change array in the history key

    changeObj.changes.forEach((change) => {

        //check the type of change

        if (change.property === 'variations') {
            //before and after are partial variation maps containing only changed parts of variation
            var beforeVariations = deconstructWebVariationList(change.before);
            var afterVariations = deconstructWebVariationList(change.after);

            //check if all variaitons are in both befores and afters
            //if variaiton is missing in after, variation was deleted.
            //variations can't be restored, warn that this change can not be undone
            //if variation is missing in before, variation was added
            //delete variation, warn that this cannot be undone
            //if variations match
            //check that pages match
            //they should since modifying page settings is a different property
            //if the pages don't match
            //throw an error, idk what to do here
            //if the pages match
            //check if before and after both have change ID
            //if they do, change was modify. so find change in propdict and set it to before value
            //if before exists but not after, change was deleted. so add before change to propdict
            //if after exists but not before, change was created. so delete change from propdict

            var beforeVariationsIDs = Object.keys(beforeVariations);
            var afterVariationsIDs = Object.keys(afterVariations);

            beforeVariationsIDs.forEach((beforeVariationID) => {
                //checking that all variations in before exist in after
                if (!afterVariationsIDs.includes(beforeVariationID)) {
                    //before variation is missing after
                    //means variation was deleted
                    propertyDict.revertToExperiment = false;
                    propertyDict.reasons.push('Variation ' + beforeVariationID + ' was Stopped. Variations Cannot be Restarted.');

                    //adding variation to propertyDict
                    propertyDict.variations[beforeVariationID] = beforeVariations[beforeVariationID];

                    //before variation has been handled, removing from beforeVariations
                    delete beforeVariations[beforeVariationID];
                }
            });

            afterVariationsIDs.forEach((afterVariationID) => {
                //checking that all variations in after exist in before
                if (!beforeVariationsIDs.includes(afterVariationID)) {
                    //after variation is missing before
                    //means variation was added
                    propertyDict.warnings.push('Variation ' + afterVariationID + ' was Added. Reverting will Stop the Variation Permanently.');

                    //deleting variation from propertyDict
                    delete propertyDict.variations[afterVariationID];

                    //after variation has been handled, removing from afterVariations
                    delete afterVariations[afterVariationID];
                };
            });

            //updating variations from before/after that still have to be handled
            beforeVariationsIDs = Object.keys(beforeVariations);
            afterVariationsIDs = Object.keys(afterVariations);

            if (!arraysHaveSameValues(beforeVariationsIDs, afterVariationsIDs)) {
                //throw error if before, after, and current variations don't match
                throw new Error('Before, and After Do Not Have the same Variations (after variation add/delete handling).');
            };

            beforeVariationsIDs.forEach((variationID) => {

                var beforePages = beforeVariations[variationID].pages;
                var afterPages = afterVariations[variationID].pages;

                var beforePagesIDs = Object.keys(beforePages);
                var afterPagesIDs = Object.keys(afterPages);

                beforePagesIDs.forEach((beforePageID) => {
                    //checking that all pages in before exist in after
                    if (!afterPagesIDs.includes(beforePageID)) {
                        //before page is missing after
                        //means page was deleted or all changes from page were deleted.

                        //adding page to propertyDict
                        propertyDict.variations[variationID].pages[beforePageID] = beforePages[beforePageID];

                        //before page has been handled, removing from beforePages
                        delete beforePages[beforePageID];
                    }
                });

                afterPagesIDs.forEach((afterPageID) => {
                    //checking that all pages in after exist in before
                    if (!beforePagesIDs.includes(afterPageID)) {
                        //after page is missing before
                        //means page was added or all changes were added to page
                        //deleting page from propertyDict
                        delete propertyDict.variations[variationID].pages[afterPageID];

                        //after page has been handled, removing from afterPages
                        delete afterPages[afterPageID];
                    }
                });

                beforePagesIDs = Object.keys(beforePages);
                afterPagesIDs = Object.keys(afterPages);

                if (!arraysHaveSameValues(beforePagesIDs, afterPagesIDs)) {
                    //throw error if before, after, and current variations don't match
                    throw new Error('Before, and After Do Not Have the same Pages (after Page add/delete handling).');
                };

                beforePagesIDs.forEach((pageID) => {
                    var beforeChanges = beforePages[pageID];
                    var afterChanges = afterPages[pageID];

                    var beforeChangesIDs = Object.keys(beforeChanges);
                    var afterChangesIDs = Object.keys(afterChanges);

                    beforeChangesIDs.forEach((beforeChangeID) => {
                        //checking that all changes in before exist in after
                        if (!afterChangesIDs.includes(beforeChangeID)) {
                            //before change is missing after
                            //means change was deleted
                            //adding change to propertyDict
                            propertyDict.variations[variationID].pages[pageID][beforeChangeID] = beforeChanges[beforeChangeID];

                            //before change has been handled, removing from beforeChanges
                            delete beforeChanges[beforeChangeID];
                        }
                    });

                    afterChangesIDs.forEach((afterChangeID) => {
                        //checking that all changes in after exist in before
                        if (!beforeChangesIDs.includes(afterChangeID)) {
                            //after change is missing before
                            //means change was added
                            //deleting change from propertyDict
                            delete propertyDict.variations[variationID].pages[pageID][afterChangeID];

                            //after change has been handled, removing from afterChanges
                            delete afterChanges[afterChangeID];
                        }
                    });

                    beforeChangesIDs = Object.keys(beforeChanges);
                    afterChangesIDs = Object.keys(afterChanges);

                    if (!arraysHaveSameValues(beforeChangesIDs, afterChangesIDs)) {
                        //throw error if before, after, and current variations don't match
                        throw new Error('Before, and After Do Not Have the same Changes (after Change add/delete handling).');
                    };

                    beforeChangesIDs.forEach((changeID) => {
                        propertyDict.variations[variationID].pages[pageID][changeID] = beforeChanges[changeID];
                    });
                });
            });
        }
        else if (change.property === 'page_ids' || change.property === 'url_targeting') {
            if (change.after && change.before) {
                //change was an update, swap property to before
                propertyDict[change.property] = change.before;
            }
            else {
                //change was switching from page IDs to URL targeting (or vice versa)
                //first, clear all previous targeting updates from Q
                propertyDict.targetingChanged = true;

                if (change.after) {
                    //change was delete targeting type, set targeting type to nothing
                    propertyDict[change.property] = undefined;
                }
                else if (change.before) {
                    //change was switch from targeting type, set targeting type to before
                    propertyDict[change.property] = change.before;
                }
                else {
                    throw new Error('No Before or After Targeting found');
                }
            }
        }
        else {
            //change was a simple property change
            propertyDict[change.property] = change.before;
        }
    });

    return propertyDict;
};

async function revertWebChanges(message, sender, sendResponse) {

    var tabId = sender.tab.id;

    const messageComponents = message.type.split('-');

    if (messageComponents[1] === 'init') {
        //initializing the revertWebChanges process
        //parse the message content for needed information
        try {
            log({
                type: 'debug',
                content: ('Parsing Message Content: ', message)
            });

            //getting change info from message
            var requestID = message.uuid;
            var changeID = message.changeID;
            var experimentID = message.experimentID;
            var projectID = message.projectID;

            log({
                type: 'debug',
                content: 'Recieved Change ' + changeID + ' for Experiment/Project ' + experimentID + '/' + projectID
            });

            sendResponse({
                message: 'Initialization Successful',
                success: true
            });

        } catch (error) {
            log({
                type: 'error',
                content: ('Error Parsing Message Content: ', error)
            });
            sendResponse({
                message: error,
                success: false
            });
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

            features = features.object;

            if (authorization && features) {
                log({
                    type: 'debug',
                    content: ('Authorization Fetched: ', authorization)
                });
                chrome.tabs.sendMessage(tabId, {
                    type: "revertWebChange-statusUpdate",
                    uuid: requestID,
                    message: 'Authorization Fetched Successfully'
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
            chrome.tabs.sendMessage(tabId, {
                type: "revertWebChange-error",
                uuid: requestID,
                message: error
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
                        chrome.tabs.sendMessage(tabId, {
                            type: "revertWebChange-statusUpdate",
                            uuid: requestID,
                            message: 'Experiment Config Fetched via Scraped Token'
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
                            chrome.tabs.sendMessage(tabId, {
                                type: "revertWebChange-statusUpdate",
                                uuid: requestID,
                                message: 'Experiment Config Fetched via Stored Token'
                            });
                        }
                    } catch (error) {
                        sentResponse = true;
                        chrome.tabs.sendMessage(tabId, {
                            type: "revertWebChange-error",
                            uuid: requestID,
                            message: 'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.'
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
                        chrome.tabs.sendMessage(tabId, {
                            type: "revertWebChange-statusUpdate",
                            uuid: requestID,
                            message: 'Experiment Config Fetched via Stored Token'
                        });
                    }
                } catch (error) {
                    sentResponse = true;
                    chrome.tabs.sendMessage(tabId, {
                        type: "revertWebChange-error",
                        uuid: requestID,
                        message: 'Error Fetching Authorization. Stored Token is inavlid for this account. You\'ve indicated that the extension should use the stored Personal Access Token to Access the Optimizely API. Please disable use of the stored token or provide a valid Personal Access Token for this account.'
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
                chrome.tabs.sendMessage(tabId, {
                    type: "revertWebChange-error",
                    uuid: requestID,
                    message: error
                });
            }
            return false;
        }

        //at this point we know which API token we're using. We can fetch change history and modify the experiment config at the same time
        //getting experiment history from the Optimizely REST API AND updating the experiment config
        try {
            var changesPromise = new Promise((resolve, reject) => {

                log({
                    type: 'debug',
                    content: 'Fetching Experiment History'
                });

                var changes = fetchWebHistory(experimentID, projectID, useScrape ? authorization.scraped : authorization.stored).then((changes) => {
                    if (!changes) {
                        throw new Error('Failed to Fetch Experiment History');
                    }
                    else {
                        chrome.tabs.sendMessage(tabId, {
                            type: "revertWebChange-statusUpdate",
                            uuid: requestID,
                            message: 'Experiment History Fetched Successfully'
                        });
                    }

                    resolve(changes);
                });

                return (changes)
            });

            var configPromise = new Promise((resolve, reject) => {
                log({
                    type: 'debug',
                    content: 'Buidling Property Dict for Experiment ' + experimentID
                });

                var propertyDict = {};

                //adding a flag to the property dict to determine if targeting has been changed
                //if it has, the targeting of the experiment has to be updated FIRST before any changes to variations are updated
                propertyDict.targetingChanged = false;
                //adding a flag to the property dict to determine if the changes can be reverted to the same experiment
                propertyDict.revertToExperiment = true;
                //adding a array to the property dict to hold warnings for revert
                propertyDict.warnings = [];
                //adding a array to the property dict to hold errors/reasons why revert to experiment isn't possible
                propertyDict.reasons = [];
                //adding the change being reverted to the property dict
                propertyDict.changeID = changeID;
                //adding the experiment type to the property dict
                propertyDict.type = experimentConfig.type;
                //adding the project ID to the property dict
                propertyDict.project_id = parseInt(projectID, 10);;

                //adding the current experiment status to the property dict
                if (experimentConfig.status === 'not_started'){
                    currentStatus = 'publish';
                }
                else if(experimentConfig.status === 'paused') {
                    currentStatus = 'pause';
                }
                else if (experimentConfig.status === 'running') {
                    propertyDict.status = 'resume';
                }
                else {
                    propertyDict.status = 'pause';
                }

                log({
                    type: 'debug',
                    content: 'Current Experiment Status: ' + propertyDict.status
                });

                //handling simple properties
                propertyDict['name'] = experimentConfig.name;
                propertyDict['description'] = experimentConfig.description;
                propertyDict['audience_conditions'] = experimentConfig.audience_conditions;
                propertyDict['holdback'] = experimentConfig.holdback;
                propertyDict['metrics'] = experimentConfig.metrics;
                propertyDict['changes'] = experimentConfig.changes;
                propertyDict['schedule'] = experimentConfig.schedule;
                log({
                    type: 'debug',
                    content: 'Simple Properties of Experiment ' + experimentID + ' deconstructed'
                });

                //handling page and url targeting
                if (experimentConfig.page_ids) {
                    log({
                        type: 'debug',
                        content: 'Experiment ' + experimentID + ' is using Page Targeting'
                    });
                    propertyDict['page_ids'] = experimentConfig.page_ids;
                    propertyDict['url_targeting'] = undefined;
                }
                else if (experimentConfig.url_targeting) {
                    log({
                        type: 'debug',
                        content: 'Experiment ' + experimentID + ' is using URL Targeting'
                    });
                    propertyDict['page_ids'] = undefined;
                    propertyDict['url_targeting'] = experimentConfig.url_targeting;
                }
                else {
                    throw new Error('Experiment ' + experimentID + ' has both or neither Page and URL Targeting');
                };
                log({
                    type: 'debug',
                    content: 'Page/URL Targeting of Experiment ' + experimentID + ' deconstructed'
                });

                //handling variations
                propertyDict.variations = deconstructWebVariationList(experimentConfig.variations);
                log({
                    type: 'debug',
                    content: 'Variation Changes of Experiment ' + experimentConfig.id + ' deconstructed'
                });

                chrome.tabs.sendMessage(tabId, {
                    type: "revertWebChange-statusUpdate",
                    uuid: requestID,
                    message: 'Experiment Config Deconstructed Successfully'
                });

                resolve(propertyDict);
            });

            var [changes, propertyDict] = await Promise.all([changesPromise, configPromise]);

            if (!changes || !propertyDict) {
                throw new Error('Failed to Fetch Experiment History or Update Experiment Config');
            }
        } catch (error) {
            log({
                type: 'error',
                content: ('Error Fetching Experiment History/Updating Config: ', error)
            });
            chrome.tabs.sendMessage(tabId, {
                type: "revertWebChange-error",
                uuid: requestID,
                message: error
            });
            return false;
        }

        //reverting to specified change
        try {
            for (let i = 0; i < changes.length; i++) {
                const change = changes[i];
                if (change.change_type == "update") {
                    propertyDict = revertWebChange(propertyDict, change);

                    if (!propertyDict) {
                        throw new Error('Failed to Revert Change ' + change.id);
                    }

                    chrome.tabs.sendMessage(tabId, {
                        type: "revertWebChange-statusUpdate",
                        uuid: requestID,
                        message: 'Change ' + change.id + ' Reverted Successfully'
                    });
                }
                else {
                    log({
                        type: 'debug',
                        content: 'Change ' + change.id + ' is not an Update, Skipping...'
                    });
                    chrome.tabs.sendMessage(tabId, {
                        type: "revertWebChange-statusUpdate",
                        uuid: requestID,
                        message: 'Change ' + change.id + ' is not of type update, skipping'
                    });
                }

                //if the change reverted is the one we are looking for, break the loop
                if (change.id == parseInt(changeID, 10)) {
                    break;
                };
            }
        } catch (error) {
            log({
                type: 'error',
                content: ('Error Reverting Change: ', error)
            });
            chrome.tabs.sendMessage(tabId, {
                type: "revertWebChange-error",
                uuid: requestID,
                message: error
            });
            return false;
        }

        //reconstructing propertyDict into a format that can be posted to the Optimizely API
        try {
            log({
                type: 'debug',
                content: 'Reconstructing Property Dict for Experiment ' + experimentID
            });

            //reconstructing variations
            propertyDict.variations = reconstructWebVariationDict(propertyDict.variations);

            log({
                type: 'debug',
                content: 'Property Dict for Experiment ' + experimentID + 'Reconstructed'
            });

            chrome.tabs.sendMessage(tabId, {
                type: "revertWebChange-revertReady",
                uuid: requestID,
                message: 'Property Dict Reconstructed Successfully',
                object: propertyDict,
                experimentID: experimentID,
            });
        } catch (error) {
            log({
                type: 'error',
                content: ('Error Reconstructing Property Dict: ', error)
            });
            chrome.tabs.sendMessage(tabId, {
                type: "revertWebChange-error",
                uuid: requestID,
                message: error
            });
            return false;
        }
    }
    else if (messageComponents[1] === 'postChanges') {
        //collecting the information from the message
        try {
            log({
                type: 'debug',
                content: ('Parsing Message Content: ', message)
            });

            var requestID = message.uuid;
            var revertToExperiment = message.revertToExperiment;
            var experimentID = message.experimentID;
            var propertyDict = message.object;

            var targetingChanged = propertyDict.targetingChanged;
            delete propertyDict.targetingChanged;

            var experimentStatus = propertyDict.status;
            delete propertyDict.status;

            var changeID = propertyDict.changeID;
            delete propertyDict.changeID;

        } catch (error) {
            log({
                type: 'error',
                content: ('Error Parsing Message Content: ', error)
            });
            sendResponse({
                message: error,
                success: false
            });
        }

        //getting the authorization from session storage
        try {

            log({
                type: 'debug',
                content: 'Fetching Authorization'
            });

            var [authorization, features] = await Promise.all([fetchAuthorizationFromStorage(), fetchFeaturesFromStorage()]);

            features = features.object;

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

        //posting changes to the Optimizely API
        if (revertToExperiment) {
            try {
                log({
                    type: 'debug',
                    content: 'Posting Changes to Experiment ' + experimentID
                });

                //deleting keys only needed for creating a new experiment
                delete propertyDict.project_id;
                delete propertyDict.type;

                var useScrape = features.prioritizeScrape;
                var sentResponse = false;

                //if targeting was changed, targeting first has to be pushed to the API
                if (targetingChanged) {
                    try {
                        await postWebChangeToExperiment({
                            experimentID: experimentID,
                            action: experimentStatus,
                            body: JSON.stringify(propertyDict.page_ids ? { page_ids: propertyDict.page_ids } : { url_targeting: propertyDict.url_targeting })
                        }, authorization.scraped);
                        if (experimentConfig) {
                            log({
                                type: 'debug',
                                content: ('Targeting Updated via Scraped Token: ', experimentConfig)
                            });
                        }
                    } catch (error) {
                        log({
                            type: 'info',
                            content: ('Error Targeting Updated via Scraped Token: ', error)
                        });
                        log({
                            type: 'debug',
                            content: 'Attempting to Update Targeing via Stored Token'
                        });
                        useScrape = false;
                        try {
                            await postWebChangeToExperiment({
                                experimentID: experimentID,
                                action: experimentStatus,
                                body: JSON.stringify(propertyDict.page_ids ? { page_ids: propertyDict.page_ids } : { url_targeting: propertyDict.url_targeting })
                            }, authorization.stored);
                            if (experimentConfig) {
                                log({
                                    type: 'debug',
                                    content: ('Targeting Updated via Stored Token: ', experimentConfig)
                                });
                            }
                        } catch (error) {
                            sentResponse = true;
                            sendResponse({
                                message: 'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                                success: false
                            });
                            throw new Error('Error Updating Targeting via Stored Token: ', error);
                        }
                    }
                }

                if (targetingChanged) {
                    await postWebChangeToExperiment({
                        experimentID: experimentID,
                        action: experimentStatus,
                        body: JSON.stringify(propertyDict)
                    }, useScrape ? authorization.scraped : authorization.stored);

                    log({
                        type: 'debug',
                        content: 'Changes Posted to Experiment ' + experimentID
                    });
                }
                else {
                    try {
                        await postWebChangeToExperiment({
                            experimentID: experimentID,
                            action: experimentStatus,
                            body: JSON.stringify(propertyDict)
                        }, authorization.scraped);
                        if (experimentConfig) {
                            log({
                                type: 'debug',
                                content: ('Posted Experiment Changes via Scraped Token: ', experimentConfig)
                            });
                        }
                    } catch (error) {
                        log({
                            type: 'info',
                            content: ('Error Posting Experiment Changes via Scraped Token: ', error)
                        });
                        log({
                            type: 'debug',
                            content: 'Attempting to Post Experiment Changes via Stored Token'
                        });
                        useScrape = false;
                        try {
                            await postWebChangeToExperiment({
                                experimentID: experimentID,
                                action: experimentStatus,
                                body: JSON.stringify(propertyDict)
                            }, authorization.stored);
                            if (experimentConfig) {
                                log({
                                    type: 'debug',
                                    content: ('Posted Experiment Changes via Stored Token: ', experimentConfig)
                                });
                            }
                        } catch (error) {
                            sentResponse = true;
                            sendResponse({
                                message: 'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                                success: false
                            });
                            throw new Error('Error Posting Experiment Changes via Stored Token: ', error);
                        }
                    }
                }

                sendResponse({
                    message: 'Changes Posted to Experiment ' + experimentID,
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
            }

        }
        else {
            try {
                propertyDict.name = '[' + changeID + '] - ' + propertyDict.name;

                await postWebChangeToNewExperiment({
                    action: experimentStatus,
                    body: JSON.stringify(propertyDict)
                }, authorization.scraped);
                if (experimentConfig) {
                    log({
                        type: 'debug',
                        content: ('Posted Experiment Changes via Scraped Token: ', experimentConfig)
                    });
                }
            } catch (error) {
                log({
                    type: 'info',
                    content: ('Error Posting Experiment Changes via Scraped Token: ', error)
                });
                log({
                    type: 'debug',
                    content: 'Attempting to Post Experiment Changes via Stored Token'
                });
                useScrape = false;
                try {
                    await postWebChangeToNewExperiment({
                        action: experimentStatus,
                        body: JSON.stringify(propertyDict)
                    }, authorization.stored);
                    if (experimentConfig) {
                        log({
                            type: 'debug',
                            content: ('Posted Experiment Changes via Stored Token: ', experimentConfig)
                        });
                    }
                } catch (error) {
                    sentResponse = true;
                    sendResponse({
                        message: 'Error Fetching Authorization. You\'ve indicated that the extension should use a scraped token, but the scraped token couldn\'t be found or is invalid. Please visit a page in the Optimizely Web App that triggers a REST API request (See Extension Documentation on GitHub). Alternatively, provide a Personal Access Token in the extension options page for this account.',
                        success: false
                    });
                    throw new Error('Error Posting Experiment Changes via Stored Token: ', error);
                }
            }
        }

        //posting the changes to the Optimizely API
        //testing both tokens here too
    }

    return true;
};

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
            message: error.message,
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

        features = features.object;

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
            message: error.message,
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
                sentResponse = true;
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
        for (const variation of experimentConfig.variations) {
            if (variation.variation_id == variationID) {
                for (const action of variation.actions) {
                    for (const change of action.changes) {
                        if (change.id.includes(firstChangeID)) {
                            foundAction = true;
                            break;
                        }
                    }

                    //send the changes back to the page
                    if (foundAction) {
                        log({
                            type: 'info',
                            content: 'Found Changes on Page ID ' + action.page_id + ', Sending Back to Page...'
                        });

                        for (const change of action.changes) {
                            if (requestedChanges.includes(change.id)) {
                                changesExport.push(change);
                            }
                        }
                        break;
                    }
                }
            }

            if (foundAction) {
                break;
            }
        };

        if (!foundAction || changesExport.length === 0) {
            throw new Error('Unable to Find Changes from Anchor Change');
        }

    }
    catch (error) {
        log({
            type: 'error',
            content: ('Error Collecting Changes to Export: ', error)
        });
        sendResponse({
            message: error.message,
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
            message: error.message,
            success: false
        });
        return false;
    };
};

//Helper Function for importVariationChanges ->  finds the page ID(s) to import changes to for the import function. needs to exists because there is no way to scrape the current page ID from the app UI so we need to guess based on the information available
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

        if (!Array.isArray(importedChanges)) {
            throw new Error('Imported changes should be an array');
        }
        else {
            importedChanges.forEach((change) => {
                if (typeof change.async === 'undefined' || !change.attributes || !change.css || !change.dependencies || !change.id || !change.rearrange || !change.selector || !change.type) {
                    console.log(change);
                    throw new Error('Imported Changes Incorrectly Formated');
                }
            });
        }

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
            message: error.message,
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

        features = features.object;

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
            message: error.message,
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
                sentResponse = true;
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

        // checking if Experiment is using URL Targeting or Page ID Targeting

        var pageIDs = [];

        if(experimentConfig.page_ids) {
            pageIDs = await findPageIDs(experimentConfig, variationID, message.type.split('-')[1], matchContent, useScrape ? authorization.scraped : authorization.stored);
        }
        else {
            pageIDs = [experimentConfig.url_targeting.page_id];
        }

        //getting page ID(s) where the changes will be imported
        
    } catch (error) {
        log({
            type: 'error',
            content: ('Error Finding Page ID to Import Changes: ', error)
        });
        sendResponse({
            message: error.message,
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
            if (variation.variation_id === variationID && variation.actions.length === 0) {
                for (const page_id of pageIDs) {
                    variation.actions.push({
                        page_id: page_id,
                        changes: importedChanges
                    });
                }
                appledChanges = true;
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
            message: error.message,
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
        if (experimentConfig.status === 'not_started'){
            currentStatus = 'publish';
        }
        else if(experimentConfig.status === 'paused') {
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
            message: error.message,
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
            message: error.message,
            success: false
        });
        return false;
    }
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
            message: error.message,
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

        features = features.object;

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
            message: error.message,
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
                sentResponse = true;
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
            message: error.message,
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
        if (experimentConfig.status === 'not_started'){
            currentStatus = 'publish';
        }
        else if(experimentConfig.status === 'paused') {
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
            message: error.message,
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
            message: error.message,
            success: false
        });
        return false;
    }

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
            message: error.message,
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

        features = features.object;

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
            message: error.message,
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
                sentResponse = true;
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
        if (experimentConfig.status === 'not_started'){
            currentStatus = 'publish';
        }
        else if(experimentConfig.status === 'paused') {
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
            message: error.message,
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
            message: error.message,
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
            message: error.message,
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
            message: error.message,
            success: false
        });
        return false;
    }

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
    else if (messageType === 'revertWebChange') {
        //revert web changes message received
        log({
            type: 'debug',
            content: 'Revert Web Changes Message Received'
        });

        //revert web changes
        revertWebChanges(message, sender, sendResponse);
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
                    copyNames: true,
                    logLevel: 'error',
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

