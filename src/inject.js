//----------Global Variables----------
//global object for storing data
window.optimizelyUIExtended = {
    //functions
    observeElementChanges: function (selector, callback) {
        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                callback(document.querySelector(selector), observer);
            }
        });

        // Start observing the document body for configured mutations
        observer.observe(document.body, {
            childList: true,  // Observe direct children
            subtree: true,    // Observe all descendants
            attributes: true  // Observe attribute changes
        });
    },
    logLevel: 0,
    setLogLevel: function (level) {
        if (level == 'full') {
            self.logLevel = 4;
        }
        else if (level == 'debug') {
            self.logLevel = 3;
        }
        else if (level == 'info') {
            self.logLevel = 2;
        }
        else if (level == 'error') {
            self.logLevel = 1;
        }
        else {
            self.logLevel = 0;
        }
    },
    log: function (log) {
        let level;
        switch (log.type) {
            case 'full':
                level = 4;
                break;
            case 'debug':
                level = 3;
                break;
            case 'info':
                level = 2;
                break;
            case 'error':
                level = 1;
                break;
            default:
                level = 0;
        }

        if (level <= self.logLevel) {
            if (level == 1) {
                console.error('[Optimizely UI Extended Extension]', log.content);
            }
            else {
                console.log('[Optimizely UI Extended Extension]', log.content);
            }
        }
    },
    getUUID: function () {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
};
//--------End Global Variables--------

//----------Functions----------
function getPendingSetPages() {
    var pagesLiElements = document.querySelector('[data-test-section="p13n-editor-pages"]').querySelectorAll('ul.lego-block-list.push-double--bottom > li');

    pages = [];

    pagesLiElements.forEach(element => {
        pageName = element.querySelector('.axiom-typography--caption.push-half--right').innerHTML;
        temp = element.querySelector('.micro.muted.soft-half--left').getAttribute('data-test-section').split('-');
        pageID = temp[temp.length - 1];
        pages.push({
            'name': pageName,
            'id': pageID
        });
    });

    return pages;
}

function createErrorPopup(message) {

    window.optimizelyUIExtended.log({
        type: 'error',
        content: message
    });

    var backgroundBlur = document.createElement('div');
    backgroundBlur.classList.add('page-overlay', 'page-overlay--faint');
    backgroundBlur.style.zIndex = '2999';

    var errorPopup = document.createElement('div');
    errorPopup.classList.add('dialog--wrapper', 'dialog--shown');
    errorPopup.style.zIndex = '3000';
    errorPopup.innerHTML = `
        <div class="dialog dialog--shadow">
            <div class="lego-dialog__close optimizelyExtended-closeButton" data-test-section="standard-dialog-close">
                <svg class="lego-icon">
                    <use xlink:href="#xmark-16"></use>
                </svg>
            </div>
            <div>
                <div class="lego-dialog--narrow" data-test-section="confirm-dialog">
                    <div class="lego-dialog__header">
                        <h2 class="lego-dialog__title flush--bottom optimizely-transfer-changes-popup_marker"
                            data-test-section="confirm-dialog-title">
                            Error
                        </h2>
                    </div>
                    <div class="lego-dialog__body" data-test-section="confirm-dialog-body">
                        ${message}
                    </div>
                </div>
            </div>
        </div>
    `;

    //event listener for close button
    errorPopup.querySelector('.optimizelyExtended-closeButton').addEventListener('click', function (event) {
        window.location.reload();
    });

    //clearing all existing dialogs
    dialogManager = document.querySelector('#root').querySelector('#dialog-manager');
    dialogManager.classList.remove('modal--full')
    dialogManager.innerHTML = '';
    dialogManager.appendChild(backgroundBlur);
    dialogManager.appendChild(errorPopup);
}

function createInfoPopup(message) {
    var backgroundBlur = document.createElement('div');
    backgroundBlur.classList.add('page-overlay', 'page-overlay--faint');
    backgroundBlur.style.zIndex = '2999';

    var infoPopup = document.createElement('div');
    infoPopup.classList.add('dialog--wrapper', 'dialog--shown');
    infoPopup.style.zIndex = '3000';
    infoPopup.innerHTML = `
        <div class="dialog dialog--shadow">
            <div class="lego-dialog__close optimizelyExtended-closeButton" data-test-section="standard-dialog-close">
                <svg class="lego-icon">
                    <use xlink:href="#xmark-16"></use>
                </svg>
            </div>
            <div>
                <div class="lego-dialog--narrow" data-test-section="confirm-dialog">
                    <div class="lego-dialog__header">
                        <h2 class="lego-dialog__title flush--bottom optimizely-transfer-changes-popup_marker"
                            data-test-section="confirm-dialog-title">
                            Info
                        </h2>
                    </div>
                    <div class="lego-dialog__body" data-test-section="confirm-dialog-body">
                        ${message}
                    </div>
                </div>
            </div>
        </div>
    `;
    dialogManager = document.querySelector('#root').querySelector('#dialog-manager');

    //event listener for close button
    infoPopup.querySelector('.optimizelyExtended-closeButton').addEventListener('click', function (event) {
        dialogManager.classList.add('modal--full')
        infoPopup.remove();
    });

    //clearing all existing dialogs
    dialogManager.classList.remove('modal--full')
    dialogManager.innerHTML = '';
    dialogManager.appendChild(backgroundBlur);
    dialogManager.appendChild(infoPopup);
}

function createInteractivePopup(message, buttonElements = [], closeFunction = function () { }, requestID = undefined) {
    var backgroundBlur = document.createElement('div');
    backgroundBlur.classList.add('page-overlay', 'page-overlay--faint');
    backgroundBlur.style.zIndex = '2999';

    var interactivePopup = document.createElement('div');
    if (requestID) {
        interactivePopup.id = requestID;
    }
    interactivePopup.classList.add('dialog--wrapper', 'dialog--shown', 'optimizelyExtended-interactivePopup');
    interactivePopup.style.zIndex = '3000';
    interactivePopup.innerHTML = `
        <div class="dialog dialog--shadow">
            <div class="lego-dialog__close optimizelyExtended-closeButton" data-test-section="standard-dialog-close">
                <svg class="lego-icon">
                    <use xlink:href="#xmark-16"></use>
                </svg>
            </div>
            <div>
                <div class="lego-dialog--narrow" data-test-section="confirm-dialog">
                    <div class="lego-dialog__header">
                        <h2 class="lego-dialog__title flush--bottom optimizely-transfer-changes-popup_marker" data-test-section="confirm-dialog-title">
                            Info
                        </h2>
                    </div>
                    <div class="lego-dialog__body" data-test-section="confirm-dialog-body">
                        ${message}
                    </div>
                    <div class="lego-dialog__footer lego-button-row--right optimizelyExtended-buttonContainer">
                     </div>
                </div>
            </div>
        </div>
    `;

    //adding buttons
    buttonElements.forEach(button => {
        interactivePopup.querySelector('.optimizelyExtended-buttonContainer').appendChild(button);
    });

    //event listener for close button
    interactivePopup.querySelector('.optimizelyExtended-closeButton').addEventListener('click', closeFunction);

    //clearing all existing dialogs
    dialogManager = document.querySelector('#root').querySelector('#dialog-manager');
    dialogManager.classList.remove('modal--full')
    dialogManager.innerHTML = '';
    dialogManager.appendChild(backgroundBlur);
    dialogManager.appendChild(interactivePopup);
}

//--------End Functions--------

//ADD OTHER FUNCTIONS HERE FOR OTHER FEATURES

//-----------Web Revert Functions---------
//sends message to service worker to initiate revert
//once service worker confirms it has started on the revert, create the overlay

function addRevertWebOverlayErrorLine(uuid, message) {
    //get existing list
    var errorList = document.getElementById(uuid).querySelector('.optimizelyExtended-revertWebContent_errorList');
    //dipslay the warning list if it is hidden
    if (errorList.classList.contains('optimizelyExtended-revertWebContentHidden')) {
        errorList.classList.remove('optimizelyExtended-revertWebContentHidden');
    }

    var errorLi = document.createElement("li");
    errorLi.classList.add('revertWebUpdate_logItem');
    errorLi.innerHTML(message);

    errorList.appendChild(errorLi);
    errorList.scrollTop = errorList.scrollHeight;
}

function addRevertWebOverlayWarningLine(uuid, message) {
    //get existing list
    var warningList = document.getElementById(uuid).querySelector('.optimizelyExtended-revertWebContent_warningList');
    //dipslay the warning list if it is hidden
    if (warningList.classList.contains('optimizelyExtended-revertWebContentHidden')) {
        warningList.classList.remove('optimizelyExtended-revertWebContentHidden');
    }

    var warningLi = document.createElement("li");
    warningLi.classList.add('revertWebUpdate_logItem');
    warningLi.innerHTML(message);

    warningList.children[0].appendChild(warningLi);
    warningList.children[0].scrollTop = warningList.children[0].scrollHeight;
}

function addRevertWebOverlayLogLine(uuid, message) {
    //get existing log container
    var logList = document.getElementById(uuid).querySelector('.optimizelyExtended-revertWebContent_logList');

    var logLi = document.createElement("li");
    logLi.classList.add('revertWebUpdate_logItem');
    logLi.innerHTML = message;

    //scrolling the list to the bottom if it overflows
    logList.appendChild(logLi);
    logList.scrollTop = logList.scrollHeight;
}

function createRevertWebOverlay(uuid) {

    message = `
        <h2>Reverting Change</h2>
        <div class="optimizelyExtended-revertWebContent">
            <div class="optimizelyExtended-revertWebContent_log">
                <ul class="optimizelyExtended-revertWebContent_logList optimizelyExtended-revertWebContent_List"></ul>
            </div>
            <div class="optimizelyExtended-revertWebContent_warning optimizelyExtended-revertWebContentHidden">
                <h4 class="optimizelyExtended-revertWebContent_warningTitle">Revert Warnings:</h3>
                <ul class="optimizelyExtended-revertWebContent_warningList optimizelyExtended-revertWebContent_List"></ul>
            </div>
            <div class="optimizelyExtended-revertWebContent_error optimizelyExtended-revertWebContentHidden">
                <h4 class="optimizelyExtended-revertWebContent_errorTitle">Unable to Revert to Existing Experiment:</h3>
                <ul class="optimizelyExtended-revertWebContent_errorList optimizelyExtended-revertWebContent_List"></ul>
            </div>
        </div>
    `
    const closeFunction = function () {
        //clearing all existing dialogs
        dialogManager = document.querySelector('#root').querySelector('#dialog-manager');

        dialogManager.classList.remove('modal--full')
        dialogManager.innerHTML = '';
    }

    let cancelButton = document.createElement('button');
    cancelButton.classList.add('oui-button', 'oui-button--default', 'optimizelyExtended-revertWebCancelButton');
    cancelButton.type = 'button';
    cancelButton.innerHTML = 'Cancel Revert';
    cancelButton.addEventListener('click', closeFunction);

    let existingExperimentButton = document.createElement('button');
    existingExperimentButton.classList.add('oui-button', 'oui-button--highlight', 'oui-button--default', 'optimizelyExtended-revertWebExistingExperimentButton');
    existingExperimentButton.disabled = true;
    existingExperimentButton.type = 'button';
    existingExperimentButton.innerHTML = 'Revert Experiment Changes';

    let newExperimentButton = document.createElement('button');
    newExperimentButton.classList.add('oui-button', 'oui-button--highlight', 'oui-button--default', 'optimizelyExtended-revertWebNewExperimentButton');
    newExperimentButton.disabled = true;
    newExperimentButton.type = 'button';
    newExperimentButton.innerHTML = 'Revert Changes to New Experiment';

    let buttonElements = [cancelButton, existingExperimentButton, newExperimentButton];

    createInteractivePopup(message, buttonElements, closeFunction, uuid);

    return;
}

async function revertWebChanges(changeID) {

    //getting the experiment and project IDs from the URL
    var requestID = window.optimizelyUIExtended.getUUID();
    var experimentID = (function () {
        var url = window.location.href;
        return url.match(/projects\/(\d+)\/experiments\/(\d+)\/history/)[2];
    })();
    var projectID = (function () {
        var url = window.location.href;
        return url.match(/projects\/(\d+)\/experiments\/(\d+)\/history/)[1];
    })();

    window.optimizelyUIExtended.log({
        type: 'info',
        content: 'Revert to Change ' + changeID + ' in Project/Experiment ' + projectID + '/' + experimentID + ' Requested. Request ID: ' + requestID
    });

    await chrome.runtime.sendMessage({
        type: 'revertWebChange-init',
        changeID: changeID,
        experimentID: experimentID,
        projectID: projectID,
        uuid: requestID
    }, function (response) {
        if (response.success) {
            window.optimizelyUIExtended.log({
                type: 'info',
                content: 'Revert to Change ' + changeID + ' in Project/Experiment ' + projectID + '/' + experimentID + ' Initiated'
            });

            createRevertWebOverlay(requestID);
        }
        else {
            throw new Error('Service Worker Unable to Initialize Revert to Change ' + changeID + ' in Project/Experiment ' + projectID + '/' + experimentID + ': ' + response.message);
        };
    });

    return;
}
//---------End Web Revert Functions-------

//---------Background Script Communication Functions---------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    window.optimizelyUIExtended.log({
        type: 'info',
        content: 'Message Received from Service Worker: ' + JSON.stringify(message)
    });

    const messageComponents = message.type.split('-');

    if (messageComponents[0] === 'revertWebChange') {
        if (messageComponents[1] === 'statusUpdate') {
            //update the overlay
            addRevertWebOverlayLogLine(message.uuid, message.message);
        }
        else if (messageComponents[1] === 'revertReady') {
            //adding warnings about revert

            addRevertWebOverlayLogLine(message.uuid, ' ');
            addRevertWebOverlayLogLine(message.uuid, 'Ready to Revert Changes');
            addRevertWebOverlayLogLine(message.uuid, ' Notes About Revert:');
            addRevertWebOverlayLogLine(message.uuid, '- Able to Revert to Existing Experiment: ' + message.object.revertToExperiment);
            addRevertWebOverlayLogLine(message.uuid, '--See potential warnings about reverting to existing experiment below');
            addRevertWebOverlayLogLine(message.uuid, '--If false, see reasons below');
            addRevertWebOverlayLogLine(message.uuid, '-Targeting Changed: ' + message.object.targetingChanged);
            addRevertWebOverlayLogLine(message.uuid, '--If true, changes need to made to the targeting settings of the experiment first. Then other changes can be reverted.');
            addRevertWebOverlayLogLine(message.uuid, ' ');

            if (message.object.warnings.length > 0) {
                addRevertWebOverlayLogLine(message.uuid, 'Warnings about Reverting to Same Experiment:');
                message.object.warnings.forEach(warning => {
                    addRevertWebOverlayWarningLine(message.uuid, warning);
                });
            };
            delete message.object.warnings; //no longer needed

            if (message.object.revertToExperiment) {

                delete message.object.revertToExperiment; //no longer needed
                //we can revert this experiment
                var existingExperimentButton = document.querySelector('.optimizelyExtended-revertWebExistingExperimentButton');
                existingExperimentButton.disabled = false;
                existingExperimentButton.addEventListener('click', function (event) {
                    document.querySelector('.optimizelyExtended-revertWebExistingExperimentButton').innerHTML = `
                        <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="spinner" class="svg-inline--fa fa-spinner axiom-icon axiom-icon--small fa-fw axiom-spinner fa-spin-pulse" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" color="hsla(227, 100%, 50%, 1)" data-test-section="button-spinner"><path fill="currentColor" d="M208 48C208 21.49 229.5 0 256 0C282.5 0 304 21.49 304 48C304 74.51 282.5 96 256 96C229.5 96 208 74.51 208 48zM256 64C264.8 64 272 56.84 272 48C272 39.16 264.8 32 256 32C247.2 32 240 39.16 240 48C240 56.84 247.2 64 256 64zM208 464C208 437.5 229.5 416 256 416C282.5 416 304 437.5 304 464C304 490.5 282.5 512 256 512C229.5 512 208 490.5 208 464zM256 480C264.8 480 272 472.8 272 464C272 455.2 264.8 448 256 448C247.2 448 240 455.2 240 464C240 472.8 247.2 480 256 480zM96 256C96 282.5 74.51 304 48 304C21.49 304 0 282.5 0 256C0 229.5 21.49 208 48 208C74.51 208 96 229.5 96 256zM48 240C39.16 240 32 247.2 32 256C32 264.8 39.16 272 48 272C56.84 272 64 264.8 64 256C64 247.2 56.84 240 48 240zM416 256C416 229.5 437.5 208 464 208C490.5 208 512 229.5 512 256C512 282.5 490.5 304 464 304C437.5 304 416 282.5 416 256zM464 272C472.8 272 480 264.8 480 256C480 247.2 472.8 240 464 240C455.2 240 448 247.2 448 256C448 264.8 455.2 272 464 272zM142.9 369.1C161.6 387.9 161.6 418.3 142.9 437C124.1 455.8 93.73 455.8 74.98 437C56.23 418.3 56.23 387.9 74.98 369.1C93.73 350.4 124.1 350.4 142.9 369.1V369.1zM97.61 391.8C91.36 398 91.36 408.1 97.61 414.4C103.9 420.6 113.1 420.6 120.2 414.4C126.5 408.1 126.5 398 120.2 391.8C113.1 385.5 103.9 385.5 97.61 391.8zM74.98 74.98C93.73 56.23 124.1 56.23 142.9 74.98C161.6 93.73 161.6 124.1 142.9 142.9C124.1 161.6 93.73 161.6 74.98 142.9C56.24 124.1 56.24 93.73 74.98 74.98V74.98zM97.61 120.2C103.9 126.5 113.1 126.5 120.2 120.2C126.5 113.1 126.5 103.9 120.2 97.61C113.1 91.36 103.9 91.36 97.61 97.61C91.36 103.9 91.36 113.1 97.61 120.2zM437 437C418.3 455.8 387.9 455.8 369.1 437C350.4 418.3 350.4 387.9 369.1 369.1C387.9 350.4 418.3 350.4 437 369.1C455.8 387.9 455.8 418.3 437 437V437zM414.4 391.8C408.1 385.5 398 385.5 391.8 391.8C385.5 398 385.5 408.1 391.8 414.4C398 420.6 408.1 420.6 414.4 414.4C420.6 408.1 420.6 398 414.4 391.8z"></path></svg>
                        Reverting Experiment Changes
                    `;

                    document.querySelector('.optimizelyExtended-revertWebExistingExperimentButton').disabled = true;
                    document.querySelector('.optimizelyExtended-revertWebNewExperimentButton').disabled = true;

                    chrome.runtime.sendMessage({
                        type: 'revertWebChange-postChanges',
                        uuid: message.uuid,
                        revertToExperiment: true,
                        experimentID: message.experimentID,
                        object: message.object,
                    }, function (response) {
                        if (response.success) {
                            window.optimizelyUIExtended.log({
                                type: 'info',
                                content: 'Revert to Existing Experiment Finished'
                            });
                            window.location.reload();
                        }
                        else {
                            throw new Error('Service Worker Unable to Initiate Revert to Existing Experiment Changes: ' + response.message);
                        }
                    });
                });
            }
            else {
                addRevertWebOverlayLogLine(message.uuid, 'Reasons for Unable to Revert to Existing Experiment:');
                //add all reasons why we can't revert to this experiment
                message.object.reasons.forEach(reason => {
                    addRevertWebOverlayErrorLine(message.uuid, reason);
                });
            }
            delete message.object.reasons; //no longer needed

            //enable revert to new experiment button
            var newExperimentButton = document.querySelector('.optimizelyExtended-revertWebNewExperimentButton');
            newExperimentButton.disabled = false;
            newExperimentButton.addEventListener('click', function (event) {
                document.querySelector('.optimizelyExtended-revertWebNewExperimentButton').innerHTML = `
                <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="spinner" class="svg-inline--fa fa-spinner axiom-icon axiom-icon--small fa-fw axiom-spinner fa-spin-pulse" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" color="hsla(227, 100%, 50%, 1)" data-test-section="button-spinner"><path fill="currentColor" d="M208 48C208 21.49 229.5 0 256 0C282.5 0 304 21.49 304 48C304 74.51 282.5 96 256 96C229.5 96 208 74.51 208 48zM256 64C264.8 64 272 56.84 272 48C272 39.16 264.8 32 256 32C247.2 32 240 39.16 240 48C240 56.84 247.2 64 256 64zM208 464C208 437.5 229.5 416 256 416C282.5 416 304 437.5 304 464C304 490.5 282.5 512 256 512C229.5 512 208 490.5 208 464zM256 480C264.8 480 272 472.8 272 464C272 455.2 264.8 448 256 448C247.2 448 240 455.2 240 464C240 472.8 247.2 480 256 480zM96 256C96 282.5 74.51 304 48 304C21.49 304 0 282.5 0 256C0 229.5 21.49 208 48 208C74.51 208 96 229.5 96 256zM48 240C39.16 240 32 247.2 32 256C32 264.8 39.16 272 48 272C56.84 272 64 264.8 64 256C64 247.2 56.84 240 48 240zM416 256C416 229.5 437.5 208 464 208C490.5 208 512 229.5 512 256C512 282.5 490.5 304 464 304C437.5 304 416 282.5 416 256zM464 272C472.8 272 480 264.8 480 256C480 247.2 472.8 240 464 240C455.2 240 448 247.2 448 256C448 264.8 455.2 272 464 272zM142.9 369.1C161.6 387.9 161.6 418.3 142.9 437C124.1 455.8 93.73 455.8 74.98 437C56.23 418.3 56.23 387.9 74.98 369.1C93.73 350.4 124.1 350.4 142.9 369.1V369.1zM97.61 391.8C91.36 398 91.36 408.1 97.61 414.4C103.9 420.6 113.1 420.6 120.2 414.4C126.5 408.1 126.5 398 120.2 391.8C113.1 385.5 103.9 385.5 97.61 391.8zM74.98 74.98C93.73 56.23 124.1 56.23 142.9 74.98C161.6 93.73 161.6 124.1 142.9 142.9C124.1 161.6 93.73 161.6 74.98 142.9C56.24 124.1 56.24 93.73 74.98 74.98V74.98zM97.61 120.2C103.9 126.5 113.1 126.5 120.2 120.2C126.5 113.1 126.5 103.9 120.2 97.61C113.1 91.36 103.9 91.36 97.61 97.61C91.36 103.9 91.36 113.1 97.61 120.2zM437 437C418.3 455.8 387.9 455.8 369.1 437C350.4 418.3 350.4 387.9 369.1 369.1C387.9 350.4 418.3 350.4 437 369.1C455.8 387.9 455.8 418.3 437 437V437zM414.4 391.8C408.1 385.5 398 385.5 391.8 391.8C385.5 398 385.5 408.1 391.8 414.4C398 420.6 408.1 420.6 414.4 414.4C420.6 408.1 420.6 398 414.4 391.8z"></path></svg>
                Reverting to new Experiment
                `;
                document.querySelector('.optimizelyExtended-revertWebExistingExperimentButton').disabled = true;
                document.querySelector('.optimizelyExtended-revertWebNewExperimentButton').disabled = true;

                chrome.runtime.sendMessage({
                    type: 'revertWebChange-postChanges',
                    uuid: message.uuid,
                    revertToExperiment: false,
                    experimentID: message.experimentID,
                    object: message.object,
                }, function (response) {
                    if (response.success) {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Revert to New Experiment Finished'
                        });
                        window.location.href = `https://app.optimizely.com/v2/projects/${response.projectID}/experiments/${response.experimentID}/variations`;
                    }
                    else {
                        throw new Error('Service Worker Unable to Initiate Revert to New Experiment Changes: ' + response.message);
                    }
                });
            });
        }
        else if (messageComponents[1] === 'error') {
            window.optimizelyUIExtended.log({
                type: 'error',
                content: 'Error from Service Worker: ' + message.message
            });
            createErrorPopup(message.message);
        }
        else {
            window.optimizelyUIExtended.log({
                type: 'error',
                content: 'Unrecognized message from Service Worker: ' + JSON.stringify(message)
            });
        }
    }
    else {
        window.optimizelyUIExtended.log({
            type: 'error',
            content: 'Unrecognized message from Service Worker: ' + JSON.stringify(message)
        });
    }

    //returning false to indicate no response sent
    return false;
});

//--------End Background Script Communication Functions--------

//-----------------Main Code-----------------
//executes when the script is injected

var enabledFeatures = new Promise((resolve, reject) => {
    chrome.storage.local.get(['enabledFeatures'], function (result) {
        if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
        }
        resolve(result.enabledFeatures);
    });
}).then(enabledFeatures => {
    //do feature enabling stuff
    if (enabledFeatures.transferChanges) {
        window.optimizelyUIExtended.log({
            type: 'info',
            content: 'Transfer Changes Feature Enabled'
        });
        //TRANSFER CHANGES FEATURE
        //checks for the presence and/or change to the change history table
        //injects the revert changes button if they aren't already there
        window.optimizelyUIExtended.observeElementChanges('.lego-dialog__title.flush--bottom', element => {
            window.optimizelyUIExtended.log({
                type: 'debug',
                content: 'Popup Detected'
            });

            //checks if the popup is an unmodified Switch to Saved Pages Targeting Change popup
            //Detects the popup twice if I don't manually mark the popup with a class... not sure why
            if (element.innerHTML.includes('Switching to Saved Pages will discard changes') && (!element.classList.contains('optimizely-transfer-changes-popup_marker'))) {

                //marking the popup
                //need this to not reapply changes over any over, again, idk why lol
                element.classList.add('optimizely-transfer-changes-popup_marker');

                //getting the popup container
                var popupParent = element.parentElement.parentElement.parentElement.parentElement;

                window.optimizelyUIExtended.log({
                    type: 'info',
                    content: 'Targeting Change Type Popup Detected'
                });


                //modifying text
                popupParent.querySelector('[data-test-section="confirm-message"]').innerHTML = `
            <p>You're about to switch from URL Targeting to Page Targeting with Saved Changes.</p>
            <p>By Default, Switching to Saved Pages will discard changes made to the URL Targeting.</p>
            <div class="lego-media color--bad-news push--bottom" data-test-section="publish-warning">
                <svg class="lego-icon lego-media__img">
                    <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#exclamation-16"></use>
                </svg> 
                <div class="lego-media__body">
                    <p>Once discarded, changes cannot be recovered.</p>
                </div> 
            </div>
            <p>Would you Like to Save the Changes to a Page Target?</p>
        `
                window.optimizelyUIExtended.log({
                    type: 'debug',
                    content: 'Popup Text Modified'
                });


                //adding Pages Buttons
                pendingPages = getPendingSetPages();
                var ul = document.createElement('ul');
                pendingPages.forEach(page => {
                    var li = document.createElement('li');
                    var checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `page-${page.id}`;
                    checkbox.name = 'page';
                    checkbox.value = page.id;

                    var label = document.createElement('label');
                    label.htmlFor = `page-${page.id}`;
                    label.appendChild(document.createTextNode(page.name));

                    li.appendChild(checkbox);
                    li.appendChild(label);
                    ul.appendChild(li);
                });
                popupParent.querySelector('[data-test-section="confirm-message"]').appendChild(ul);

                window.optimizelyUIExtended.log({
                    type: 'debug',
                    content: 'Pages Options Fetched and Added'
                });


                //adding Transfer Changes Button
                var transferChangesButton = document.createElement('button');
                transferChangesButton.type = 'submit';
                transferChangesButton.classList.add('lego-button', 'lego-button--highlight');
                transferChangesButton.setAttribute('data-test-section', 'confirm-submit-button');
                transferChangesButton.innerHTML = 'Transfer Changes to Page Targeting Rules';
                popupParent.querySelector('.lego-dialog__footer.lego-button-row--right').appendChild(transferChangesButton);

                window.optimizelyUIExtended.log({
                    type: 'debug',
                    content: 'Transfer Changes Button Added'
                });

                //event listener for transfer changes button
                transferChangesButton.addEventListener('click', function (event) {

                    window.optimizelyUIExtended.log({
                        type: 'info',
                        content: 'Transfer Changes Button Clicked'
                    });

                    //disabling buttons
                    let buttonContainer = event.target.parentElement;
                    buttonContainer.querySelectorAll('*').forEach(child => {
                        child.disabled = true;
                    });

                    window.optimizelyUIExtended.log({
                        type: 'debug',
                        content: 'Buttons Disabled'
                    });

                    //changing button text to indicate that the extension is processing
                    event.target.innerHTML = `
                <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="spinner" class="svg-inline--fa fa-spinner axiom-icon axiom-icon--small fa-fw axiom-spinner fa-spin-pulse" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" color="hsla(227, 100%, 50%, 1)" data-test-section="button-spinner">
                    <path fill="currentColor" d="M208 48C208 21.49 229.5 0 256 0C282.5 0 304 21.49 304 48C304 74.51 282.5 96 256 96C229.5 96 208 74.51 208 48zM256 64C264.8 64 272 56.84 272 48C272 39.16 264.8 32 256 32C247.2 32 240 39.16 240 48C240 56.84 247.2 64 256 64zM208 464C208 437.5 229.5 416 256 416C282.5 416 304 437.5 304 464C304 490.5 282.5 512 256 512C229.5 512 208 490.5 208 464zM256 480C264.8 480 272 472.8 272 464C272 455.2 264.8 448 256 448C247.2 448 240 455.2 240 464C240 472.8 247.2 480 256 480zM96 256C96 282.5 74.51 304 48 304C21.49 304 0 282.5 0 256C0 229.5 21.49 208 48 208C74.51 208 96 229.5 96 256zM48 240C39.16 240 32 247.2 32 256C32 264.8 39.16 272 48 272C56.84 272 64 264.8 64 256C64 247.2 56.84 240 48 240zM416 256C416 229.5 437.5 208 464 208C490.5 208 512 229.5 512 256C512 282.5 490.5 304 464 304C437.5 304 416 282.5 416 256zM464 272C472.8 272 480 264.8 480 256C480 247.2 472.8 240 464 240C455.2 240 448 247.2 448 256C448 264.8 455.2 272 464 272zM142.9 369.1C161.6 387.9 161.6 418.3 142.9 437C124.1 455.8 93.73 455.8 74.98 437C56.23 418.3 56.23 387.9 74.98 369.1C93.73 350.4 124.1 350.4 142.9 369.1V369.1zM97.61 391.8C91.36 398 91.36 408.1 97.61 414.4C103.9 420.6 113.1 420.6 120.2 414.4C126.5 408.1 126.5 398 120.2 391.8C113.1 385.5 103.9 385.5 97.61 391.8zM74.98 74.98C93.73 56.23 124.1 56.23 142.9 74.98C161.6 93.73 161.6 124.1 142.9 142.9C124.1 161.6 93.73 161.6 74.98 142.9C56.24 124.1 56.24 93.73 74.98 74.98V74.98zM97.61 120.2C103.9 126.5 113.1 126.5 120.2 120.2C126.5 113.1 126.5 103.9 120.2 97.61C113.1 91.36 103.9 91.36 97.61 97.61C91.36 103.9 91.36 113.1 97.61 120.2zM437 437C418.3 455.8 387.9 455.8 369.1 437C350.4 418.3 350.4 387.9 369.1 369.1C387.9 350.4 418.3 350.4 437 369.1C455.8 387.9 455.8 418.3 437 437V437zM414.4 391.8C408.1 385.5 398 385.5 391.8 391.8C385.5 398 385.5 408.1 391.8 414.4C398 420.6 408.1 420.6 414.4 414.4C420.6 408.1 420.6 398 414.4 391.8z">
                    </path>
                </svg>
                Please Wait, Transfering Changes
            `;

                    window.optimizelyUIExtended.log({
                        type: 'debug',
                        content: 'Transfer Changes Button Text Changed'
                    });

                    //getting selected pages from checkboxes
                    let selectedPages = [];
                    ul.querySelectorAll('input[name="page"]:checked').forEach(checkbox => {
                        selectedPages.push(checkbox.value);
                    });

                    //getting all pages from checkboxes
                    //needed so we can tell the background script to change the targeting of the experiment since the app is no longer handling that either
                    let pendingPages = [];
                    ul.querySelectorAll('input[name="page"]').forEach(checkbox => {
                        pendingPages.push(checkbox.value);
                    });

                    window.optimizelyUIExtended.log({
                        type: 'debug',
                        content: 'Selected Pages Fetched'
                    });

                    //sending message to background script to transfer changes
                    chrome.runtime.sendMessage({
                        type: 'transferChanges',
                        allPages: pendingPages,
                        pages: selectedPages,
                        experimentID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[2],
                        projectID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[1]
                    },
                        function (response) {
                            if (response.success) {

                                window.optimizelyUIExtended.log({
                                    type: 'info',
                                    content: 'Changes Transferred Successfully. Reloading Page...'
                                });

                                window.location.reload();
                            }
                            else {

                                window.optimizelyUIExtended.log({
                                    type: 'error',
                                    content: 'Failed to transfer changes'
                                });

                                createErrorPopup(response.message);

                                //TODO: Add error popup informing why the error occurred
                                //Maybe undo if pages were changed but changes weren't transferred
                            }
                        });
                });
            }
        });
    }

    if (enabledFeatures.importExportDeleteChanges) {
        window.optimizelyUIExtended.log({
            type: 'info',
            content: 'Import/Export/Delete Changes Feature Enabled'
        });
        //EXPORT/IMPORT/DELETE CHANGES FEATURE
        window.optimizelyUIExtended.observeElementChanges('.sidenav__section__title.soft--bottom', element => {

            window.optimizelyUIExtended.log({
                type: 'debug',
                content: 'Sidebar Detected'
            });

            //checking to confirm that the sidebar detected is the changes sidebar we want to modify
            if (element.querySelector('[data-test-section="create-change-button"]') && element.children[0].innerHTML.includes('Changes')) {
                // found the right sidebar

                window.optimizelyUIExtended.log({
                    type: 'debug',
                    content: 'Variation Sidebar Detected'
                });

                var sideNavContainer = element.parentElement;

                //checking if the sidebar has already been modified
                if (sideNavContainer.classList.contains('optimizelyExtended-ImportExportChanges')) {
                    //element has already been modified. Ignore.

                    window.optimizelyUIExtended.log({
                        type: 'debug',
                        content: 'Sidebar Already Modified'
                    });

                }
                else {
                    //sidebar hasn't been modified yet. Add the buttons

                    window.optimizelyUIExtended.log({
                        type: 'info',
                        content: 'Adding Changes Import/Export Buttons'
                    });

                    //marking the sidebar so it isn't modified again
                    sideNavContainer.classList.add('optimizelyExtended-ImportExportChanges');


                    //modifying the create changes options to include the import button
                    //creating the import button
                    var importChangesButton = document.createElement('a');
                    importChangesButton.id = 'optimizelyExtended-importChangesButton';
                    importChangesButton.classList.add('lego-button', 'lego-button--outline', 'anchor--right', 'lego-button--disabled');
                    importChangesButton.innerHTML = `
                Import
                <span class="lego-arrow-inline--right"></span>
            `;

                    //modifying the existing container to holding the create button to display the button on the far right (need to do since I am overriding existing styles)
                    var createChangesContainer = sideNavContainer.querySelector('.sidenav__section__title.soft--bottom');
                    createChangesContainer.style.display = 'flex';
                    createChangesContainer.style.justifyContent = 'space-between';

                    //creating the container that will hold the import and create buttons
                    var createImportButtonsContainer = document.createElement('div');
                    createImportButtonsContainer.style.display = 'flex';
                    createImportButtonsContainer.style.flexDirection = 'column';

                    //adding buttons to the new container
                    createImportButtonsContainer.appendChild(createChangesContainer.children[1]);
                    createImportButtonsContainer.appendChild(importChangesButton);
                    Array.from(createImportButtonsContainer.children).forEach(child => {
                        child.style.marginTop = '10px';
                    });

                    //adding the new container to the the existing container
                    createChangesContainer.appendChild(createImportButtonsContainer);

                    //listens for when the create changes button is enabled and also enables the import changes button
                    //is only created if the create changes button is disabled
                    if (document.querySelector('[data-test-section="create-change-button"]').classList.contains('lego-button--disabled')) {
                        window.optimizelyUIExtended.observeElementChanges('[data-test-section="create-change-button"]', (element, observer) => {
                            if (element.classList.contains('lego-button--disabled') && !document.getElementById('optimizelyExtended-importChangesButton').classList.contains('lego-button--disabled')) {
                                document.getElementById('optimizelyExtended-importChangesButton').classList.remove('lego-button--disabled');
                                document.getElementById('optimizelyExtended-importChangesButton').style.pointerEvents = 'auto';
                            }
                            else if (!element.classList.contains('lego-button--disabled') && document.getElementById('optimizelyExtended-importChangesButton').classList.contains('lego-button--disabled') && !document.getElementById('optimizelyExtended-importChangesButton').classList.contains('optimizelyExtended-importChangesButton-disabled')) {
                                document.getElementById('optimizelyExtended-importChangesButton').classList.remove('lego-button--disabled');
                                document.getElementById('optimizelyExtended-importChangesButton').style.pointerEvents = 'auto';
                                //observer.disconnect(); // Disconnect the observer after it fires
                            }
                        });
                    }

                    //adding check boxes to each of the changes
                    sideNavContainer.querySelectorAll('[data-test-section="change-list-item"]').forEach(changeItem => {

                        changeItem.style.display = 'flex';
                        changeItem.style.alignItems = 'left';

                        var checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        var classStr = 'optimizelyExtended-changeCheckbox-' + changeItem.getAttribute('data-table-row-id');
                        checkbox.classList.add(classStr);
                        checkbox.style.margin = '0 10px';
                        checkbox.addEventListener('click', function (event) {
                            event.stopPropagation(); // Prevent the event from bubbling up to the parent
                            const exportButton = document.getElementById('optimizelyExtended-exportChangesButton');
                            const deleteButton = document.getElementById('optimizelyExtended-deleteChangesButton');
                            if (event.target.checked) {
                                deleteButton.disabled = false;
                                exportButton.classList.remove('lego-button--disabled');
                                exportButton.style.pointerEvents = 'auto';
                            }
                            else {
                                const allCheckboxes = document.querySelectorAll('[class^="optimizelyExtended-changeCheckbox-"]');
                                const anyChecked = Array.from(allCheckboxes).some(cb => cb.checked);
                                if (anyChecked) {
                                    deleteButton.disabled = false;
                                    exportButton.classList.remove('lego-button--disabled');
                                    exportButton.style.pointerEvents = 'auto';
                                } else {
                                    deleteButton.disabled = true;
                                    exportButton.classList.add('lego-button--disabled');
                                    exportButton.style.pointerEvents = 'none';
                                }
                            }
                        });
                        changeItem.insertBefore(checkbox, changeItem.firstChild);
                    });

                    //creating export and delete buttons att bottom of page
                    var changesButtonsContainer = document.createElement('div');
                    changesButtonsContainer.style.display = 'flex';
                    changesButtonsContainer.style.flexDirection = 'column';
                    changesButtonsContainer.style.justifyContent = 'space-between';
                    changesButtonsContainer.style.alignItems = 'center';
                    changesButtonsContainer.style.margin = '10px 10px';
                    changesButtonsContainer.style.borderTop = '1px solid #d6d6d6';
                    changesButtonsContainer.innerHTML = `
                <label style="width:100%; text-align:center; margin-top:10px;">
                    <input type="checkbox" id="optimizelyExtended-selectAllChangesCheckbox" style="margin:5px">
                    Select all Changes
                </label>
                <button type="button" id="optimizelyExtended-exportChangesButton" class="lego-button lego-button--outline" style="width:100%; margin-top:10px">
                    Export Selected Changes
                </button>
                <button type="button" id="optimizelyExtended-deleteChangesButton" class="lego-button lego-button--danger" style="width:100%; margin-top:10px">
                    Delete Selected Changes
                </button>
            `;

                    sideNavContainer.parentElement.parentElement.appendChild(changesButtonsContainer);

                    document.getElementById('optimizelyExtended-deleteChangesButton').disabled = true;
                    document.getElementById('optimizelyExtended-exportChangesButton').classList.add('lego-button--disabled');
                    document.getElementById('optimizelyExtended-exportChangesButton').style.pointerEvents = 'none';

                    //SELECT ALL CHANGES CHECKBOX
                    document.getElementById('optimizelyExtended-selectAllChangesCheckbox').addEventListener('change', function (event) {
                        const checkboxes = document.querySelectorAll('[class^="optimizelyExtended-changeCheckbox-"]');
                        checkboxes.forEach(checkbox => {
                            console.log('in here')
                            checkbox.checked = event.target.checked;
                        });
                        const exportButton = document.getElementById('optimizelyExtended-exportChangesButton');
                        const deleteButton = document.getElementById('optimizelyExtended-deleteChangesButton');
                        if (event.target.checked) {
                            deleteButton.disabled = false;
                            exportButton.classList.remove('lego-button--disabled');
                            exportButton.style.pointerEvents = 'auto';
                        }
                        else {
                            deleteButton.disabled = true;
                            exportButton.classList.add('lego-button--disabled');
                            exportButton.style.pointerEvents = 'none';
                        }

                    });

                    // Add event listeners to individual checkboxes to update the select all checkbox
                    const changeCheckboxes = document.querySelectorAll('[class^="optimizelyExtended-changeCheckbox-"]');
                    changeCheckboxes.forEach(checkbox => {
                        checkbox.addEventListener('change', function () {
                            const selectAllCheckbox = document.getElementById('optimizelyExtended-selectAllChangesCheckbox');
                            if (Array.from(changeCheckboxes).every(cb => cb.checked)) {
                                selectAllCheckbox.checked = true;
                            } else {
                                selectAllCheckbox.checked = false;
                            }
                        });
                    });

                    //EXPORT CHANGES BUTTON
                    document.getElementById('optimizelyExtended-exportChangesButton').addEventListener('click', function (event) {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Export Changes Button Clicked'
                        });

                        //disabling button, adding spinner
                        //has to be done manually since element.disable=true doesn't for this UI button style
                        event.target.style.pointerEvents = 'none';
                        event.target.classList.add('lego-button--disabled');
                        event.target.innerHTML = `
                <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="spinner" class="svg-inline--fa fa-spinner axiom-icon axiom-icon--small fa-fw axiom-spinner fa-spin-pulse" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" color="hsla(227, 100%, 50%, 1)" data-test-section="button-spinner" style="padding: 0; margin: 0">
                    <path fill="currentColor" d="M208 48C208 21.49 229.5 0 256 0C282.5 0 304 21.49 304 48C304 74.51 282.5 96 256 96C229.5 96 208 74.51 208 48zM256 64C264.8 64 272 56.84 272 48C272 39.16 264.8 32 256 32C247.2 32 240 39.16 240 48C240 56.84 247.2 64 256 64zM208 464C208 437.5 229.5 416 256 416C282.5 416 304 437.5 304 464C304 490.5 282.5 512 256 512C229.5 512 208 490.5 208 464zM256 480C264.8 480 272 472.8 272 464C272 455.2 264.8 448 256 448C247.2 448 240 455.2 240 464C240 472.8 247.2 480 256 480zM96 256C96 282.5 74.51 304 48 304C21.49 304 0 282.5 0 256C0 229.5 21.49 208 48 208C74.51 208 96 229.5 96 256zM48 240C39.16 240 32 247.2 32 256C32 264.8 39.16 272 48 272C56.84 272 64 264.8 64 256C64 247.2 56.84 240 48 240zM416 256C416 229.5 437.5 208 464 208C490.5 208 512 229.5 512 256C512 282.5 490.5 304 464 304C437.5 304 416 282.5 416 256zM464 272C472.8 272 480 264.8 480 256C480 247.2 472.8 240 464 240C455.2 240 448 247.2 448 256C448 264.8 455.2 272 464 272zM142.9 369.1C161.6 387.9 161.6 418.3 142.9 437C124.1 455.8 93.73 455.8 74.98 437C56.23 418.3 56.23 387.9 74.98 369.1C93.73 350.4 124.1 350.4 142.9 369.1V369.1zM97.61 391.8C91.36 398 91.36 408.1 97.61 414.4C103.9 420.6 113.1 420.6 120.2 414.4C126.5 408.1 126.5 398 120.2 391.8C113.1 385.5 103.9 385.5 97.61 391.8zM74.98 74.98C93.73 56.23 124.1 56.23 142.9 74.98C161.6 93.73 161.6 124.1 142.9 142.9C124.1 161.6 93.73 161.6 74.98 142.9C56.24 124.1 56.24 93.73 74.98 74.98V74.98zM97.61 120.2C103.9 126.5 113.1 126.5 120.2 120.2C126.5 113.1 126.5 103.9 120.2 97.61C113.1 91.36 103.9 91.36 97.61 97.61C91.36 103.9 91.36 113.1 97.61 120.2zM437 437C418.3 455.8 387.9 455.8 369.1 437C350.4 418.3 350.4 387.9 369.1 369.1C387.9 350.4 418.3 350.4 437 369.1C455.8 387.9 455.8 418.3 437 437V437zM414.4 391.8C408.1 385.5 398 385.5 391.8 391.8C385.5 398 385.5 408.1 391.8 414.4C398 420.6 408.1 420.6 414.4 414.4C420.6 408.1 420.6 398 414.4 391.8z">
                    </path>
                </svg>
                Exporting
                `
                        //getting list of elements representing each change in the current variation/page rule
                        var changesList = document.querySelector('.optimizelyExtended-ImportExportChanges>ul')
                        let checkedChanges = [];

                        //checking if there are any changes currently
                        if (changesList.children.length == 0) {
                            //no changes in the current variation/page rule

                            window.optimizelyUIExtended.log({
                                type: 'info',
                                content: 'No Changes Found'
                            });

                            //creating info popup informing the user that there are no changes to export
                            createInfoPopup('No Changes Created. Create changes to export.');

                            //reenabling the button/breaking out of the function by returning
                            event.target.classList.remove('lego-button--disabled');
                            event.target.style.pointerEvents = 'auto';
                            event.target.innerHTML = `
                        Export Changes
                    `;
                            return;
                        }
                        else {
                            //there are changes in the current variation/page rule to export

                            window.optimizelyUIExtended.log({
                                type: 'debug',
                                content: 'Changes Found'
                            });

                            //getting the ID of the first change in the list
                            //this is used as an anchor change to determine which page rule changes are currently being looked at
                            //there is no reference to the page ID on the page, so we have to use the first change ID as a reference
                            var firstChangeID = changesList.children[0].getAttribute('data-table-row-id');

                            //getting list of elements with checked checkboxes
                            Array.from(changesList.children).forEach(change => {
                                if (change.children[0].checked) {
                                    checkedChanges.push(change.getAttribute('data-table-row-id'));
                                }
                            });

                        }

                        //sending message to background script to export changes

                        window.optimizelyUIExtended.log({
                            type: 'debug',
                            content: 'Sending Message to Service Worker to Fetch Changes'
                        });

                        chrome.runtime.sendMessage({
                            type: 'exportVariationChanges',
                            experimentID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[2],
                            variationID: window.location.href.match(/variations\/(\d+)/)[1],
                            firstChangeID: firstChangeID,
                            requestedChanges: checkedChanges
                        }, function (response) {
                            if (response.success) {
                                //if the response from the service worker indicates that the changes were successfully exported, download the changes

                                //create an element to download the changes and click the element to download the changes, then remove the element
                                const blob = new Blob([JSON.stringify(response.message, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'changes.json';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);

                                //reenabling the button
                                event.target.classList.remove('lego-button--disabled');
                                event.target.style.pointerEvents = 'auto';
                                event.target.innerHTML = `
                            Export Changes
                        `;

                                window.optimizelyUIExtended.log({
                                    type: 'info',
                                    content: 'Changes Exported Successfully'
                                });
                            }
                            else {
                                window.optimizelyUIExtended.log({
                                    type: 'error',
                                    content: 'Failed to export changes'
                                });

                                //failed to export changes for some reason, put that reason in an error popup
                                createErrorPopup(response.message);
                            }
                        });
                    });

                    //IMPORT CHANGES BUTTON
                    document.getElementById('optimizelyExtended-importChangesButton').addEventListener('click', function (event) {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Import Changes Button Clicked'
                        });

                        //disabling button
                        //has to be done manually since element.disable=true doesn't for this UI button style
                        event.target.classList.add('lego-button--disabled');
                        event.target.style.pointerEvents = 'none';
                        //marking the button as disabled
                        event.target.classList.add('optimizelyExtended-importChangesButton-disabled');

                        //asking the user to upload a file
                        // creating a file input element
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'application/json';

                        // adding change event listener to file input
                        fileInput.addEventListener('change', function (fileInputEvent) {
                            const file = fileInputEvent.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = function (e) {
                                    const jsonContent = JSON.parse(e.target.result);
                                    // store the parsed json content in a local variable
                                    var importedChanges = jsonContent;

                                    window.optimizelyUIExtended.log({
                                        type: 'debug',
                                        content: (importedChanges)
                                    });


                                    //adding popup to indicate that changes are being imported
                                    createInfoPopup(
                                        `Importing Changes. Please Wait...`
                                    )

                                    //variable to hold the matchType key in the message object
                                    //this could be the first change ID (best), page name (good), page URL (okay) or (page name and URL) (worst)
                                    var matchContent;
                                    var messageType;

                                    //METHOD 1 of determining the current page
                                    //getting list of elements representing each change in the current variation/page rule
                                    var changesList = document.querySelector('.optimizelyExtended-ImportExportChanges>ul')

                                    //checking if there are any changes currently
                                    if (changesList.children.length == 0) {
                                        //no changes in the current variation/page rule

                                        window.optimizelyUIExtended.log({
                                            type: 'debug',
                                            content: 'No Changes for Current Page Found'
                                        });

                                        //since no changes are found, we can't identify the page in this way

                                        //next we'll see if the Page Name/URL is unique
                                        var pageDropdown = document.querySelector('.lego-dropdown-group.flex--1.push--sides.background--white');

                                        //getting current page name and URL from dropdown
                                        var pageName = pageDropdown.querySelector('span.flex--1.truncate').innerHTML.split('\n')[0].trim();
                                        var pageURL = pageDropdown.querySelector('span.drop-filter-list__description.micro.push-half--left').title;

                                        //getting all of the page elements in the dropdown
                                        var allPageElements = pageDropdown.querySelectorAll('ul[data-test-section="view-list-container"] >li[data-test-section="view-list-item"]');

                                        var nameMatches = 0;
                                        var urlMatches = 0;
                                        var bothMatches = 0;
                                        var numPages = 0;

                                        //checking each page element to see if the name and URL match the current page
                                        //there should be ONE match if the page is unique, if there is more then one match, the page rule can't be determined
                                        allPageElements.forEach(element => {
                                            var name = element.querySelector('.drop-filter-list__text').innerHTML.split('\n')[0].trim();
                                            var url = element.querySelector('[data-test-section="view-list-item-url"]').innerHTML.split('\n')[1].trim();

                                            numPages++;

                                            if (name === pageName) {
                                                nameMatches++;
                                            }

                                            if (url === pageURL) {
                                                urlMatches++;
                                            }

                                            if (name === pageName && url === pageURL) {
                                                bothMatches++;
                                            }
                                        });

                                        matchContent = {
                                            name: pageName,
                                            url: pageURL,
                                        };

                                        if (numPages == 1) {
                                            //only one page in the dropdown
                                            //means thats the only page to import changes to
                                            window.optimizelyUIExtended.log({
                                                type: 'debug',
                                                content: 'Only One Page in Dropdown'
                                            });
                                            messageType = 'importVariationChanges-singleName';
                                        }
                                        else {
                                            //there is more then one page in the dropdown
                                            if (nameMatches == 1) {
                                                //able to match page by name only (easiset way to match)
                                                window.optimizelyUIExtended.log({
                                                    type: 'debug',
                                                    content: 'Page Identified by Name'
                                                });
                                                messageType = 'importVariationChanges-name';
                                            }
                                            else if (urlMatches == 1) {
                                                //able to match page by URL only
                                                window.optimizelyUIExtended.log({
                                                    type: 'debug',
                                                    content: 'Page Identified by URL'
                                                });
                                                messageType = 'importVariationChanges-url';
                                            }
                                            else if (bothMatches == 1) {
                                                //able to match page by both name and URL
                                                window.optimizelyUIExtended.log({
                                                    type: 'debug',
                                                    content: 'Page Identified by Name and URL'
                                                });
                                                messageType = 'importVariationChanges-pageAndURL';
                                            }
                                            else {
                                                //unable to match page
                                                window.optimizelyUIExtended.log({
                                                    type: 'info',
                                                    content: 'Unable to Identify Page'
                                                });

                                                //creating a continue popup
                                                //popup message
                                                var popupMessage = `
                                            <p>Unable to Identify Page</p>
                                            <p>The Page ID of the Page Currently being viewed can't be scraped from the Web App due to how the App is designed.</p>
                                            <p>As a result this extension has to identify the Page via one of the following:</p>
                                            <p>
                                                <ul>
                                                    <li>Unique Change ID from Change available on the page</li>
                                                    <li>Unique Page Name</li>
                                                    <li>Unique Page URL</li>
                                                    <li>Unique Page Name and URL</li>
                                                </ul>
                                            </p>
                                            <p>Unfortunetly there are no changes currently on this Page Rule, and the Page Name/URL is not unique.</p>
                                            <p>As a result, the unique Page Rule can't be determined.</p>
                                            <p>Click Continue below if you're comfortable importing the changes to all Page Rules within the experiment with the name "${pageName}" and URL "${pageURL}".</p>
                                        `;

                                                //this is the function that will be called if the user closes the dialog
                                                var closeFunction = function () {
                                                    //reenabling the import changes button
                                                    document.getElementById('optimizelyExtended-importChangesButton').classList.remove('lego-button--disabled');
                                                    document.getElementById('optimizelyExtended-importChangesButton').style.pointerEvents = 'auto';
                                                    document.getElementById('optimizelyExtended-importChangesButton').classList.add('optimizelyExtended-importChangesButton-disabled');
                                                    //removing the popup
                                                    dialogManager.classList.add('modal--full')
                                                    dialogManager.innerHTML = '';
                                                }

                                                var cancelButton = document.createElement('button');
                                                cancelButton.type = 'button';
                                                cancelButton.classList.add('lego-button', 'lego-button--plain');
                                                cancelButton.innerHTML = 'Cancel';
                                                cancelButton.addEventListener('click', closeFunction);

                                                var continueButton = document.createElement('button');
                                                continueButton.type = 'button';
                                                continueButton.classList.add('lego-button', 'lego-button--highlight');
                                                continueButton.innerHTML = 'Apply Changes to All Pages with this Name and URL';
                                                continueButton.addEventListener('click', function (event) {
                                                    //user is ok with importing changes to all pages with the same name and URL

                                                    //disabling buttons
                                                    let buttonContainer = event.target.parentElement;
                                                    buttonContainer.querySelectorAll('*').forEach(child => {
                                                        child.disabled = true;
                                                    });

                                                    document.querySelector('.optimizelyExtended-closeButton').disabled = true;

                                                    event.target.innerHTML = `
                                                <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="spinner" class="svg-inline--fa fa-spinner axiom-icon axiom-icon--small fa-fw axiom-spinner fa-spin-pulse" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" color="hsla(227, 100%, 50%, 1)" data-test-section="button-spinner">
                                                    <path fill="currentColor" d="M208 48C208 21.49 229.5 0 256 0C282.5 0 304 21.49 304 48C304 74.51 282.5 96 256 96C229.5 96 208 74.51 208 48zM256 64C264.8 64 272 56.84 272 48C272 39.16 264.8 32 256 32C247.2 32 240 39.16 240 48C240 56.84 247.2 64 256 64zM208 464C208 437.5 229.5 416 256 416C282.5 416 304 437.5 304 464C304 490.5 282.5 512 256 512C229.5 512 208 490.5 208 464zM256 480C264.8 480 272 472.8 272 464C272 455.2 264.8 448 256 448C247.2 448 240 455.2 240 464C240 472.8 247.2 480 256 480zM96 256C96 282.5 74.51 304 48 304C21.49 304 0 282.5 0 256C0 229.5 21.49 208 48 208C74.51 208 96 229.5 96 256zM48 240C39.16 240 32 247.2 32 256C32 264.8 39.16 272 48 272C56.84 272 64 264.8 64 256C64 247.2 56.84 240 48 240zM416 256C416 229.5 437.5 208 464 208C490.5 208 512 229.5 512 256C512 282.5 490.5 304 464 304C437.5 304 416 282.5 416 256zM464 272C472.8 272 480 264.8 480 256C480 247.2 472.8 240 464 240C455.2 240 448 247.2 448 256C448 264.8 455.2 272 464 272zM142.9 369.1C161.6 387.9 161.6 418.3 142.9 437C124.1 455.8 93.73 455.8 74.98 437C56.23 418.3 56.23 387.9 74.98 369.1C93.73 350.4 124.1 350.4 142.9 369.1V369.1zM97.61 391.8C91.36 398 91.36 408.1 97.61 414.4C103.9 420.6 113.1 420.6 120.2 414.4C126.5 408.1 126.5 398 120.2 391.8C113.1 385.5 103.9 385.5 97.61 391.8zM74.98 74.98C93.73 56.23 124.1 56.23 142.9 74.98C161.6 93.73 161.6 124.1 142.9 142.9C124.1 161.6 93.73 161.6 74.98 142.9C56.24 124.1 56.24 93.73 74.98 74.98V74.98zM97.61 120.2C103.9 126.5 113.1 126.5 120.2 120.2C126.5 113.1 126.5 103.9 120.2 97.61C113.1 91.36 103.9 91.36 97.61 97.61C91.36 103.9 91.36 113.1 97.61 120.2zM437 437C418.3 455.8 387.9 455.8 369.1 437C350.4 418.3 350.4 387.9 369.1 369.1C387.9 350.4 418.3 350.4 437 369.1C455.8 387.9 455.8 418.3 437 437V437zM414.4 391.8C408.1 385.5 398 385.5 391.8 391.8C385.5 398 385.5 408.1 391.8 414.4C398 420.6 408.1 420.6 414.4 414.4C420.6 408.1 420.6 398 414.4 391.8z">
                                                    </path>
                                                </svg>
                                                Please Wait, Importing Changes
                                            `;

                                                    chrome.runtime.sendMessage({
                                                        type: 'importVariationChanges-all',
                                                        experimentID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[2],
                                                        variationID: window.location.href.match(/variations\/(\d+)/)[1],
                                                        matchContent: matchContent,
                                                        changes: importedChanges
                                                    }, function (response) {
                                                        if (response.success) {
                                                            //if the response from the service worker indicates that the changes were successfully imported, reload the page
                                                            window.location.reload();
                                                        }
                                                        else {
                                                            //failed to import changes for some reason, put that reason in an error popup
                                                            createErrorPopup(response.message);
                                                        }
                                                    });
                                                });

                                                createInteractivePopup(popupMessage, [cancelButton, continueButton], closeFunction);
                                            }
                                        }
                                    }
                                    else {
                                        //there are changes in the current variation/page rule to export

                                        window.optimizelyUIExtended.log({
                                            type: 'debug',
                                            content: 'Changes Found'
                                        });

                                        //getting the ID of the first change in the list
                                        //this is used as an anchor change to determine which page rule changes are currently being looked at
                                        //there is no reference to the page ID on the page, so we have to use the first change ID as a reference
                                        messageType = 'importVariationChanges-id';
                                        matchContent = changesList.children[0].getAttribute('data-table-row-id');
                                    };

                                    //sending message to background script to import changes
                                    chrome.runtime.sendMessage({
                                        type: messageType,
                                        experimentID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[2],
                                        variationID: window.location.href.match(/variations\/(\d+)/)[1],
                                        matchContent: matchContent,
                                        changes: importedChanges
                                    }, function (response) {
                                        if (response.success) {
                                            //if the response from the service worker indicates that the changes were successfully imported, reload the page
                                            window.location.reload();
                                        }
                                        else {
                                            //failed to import changes for some reason, put that reason in an error popup
                                            createErrorPopup(response.message);
                                        }
                                    });
                                }
                                reader.readAsText(file);
                            }

                        });
                        //opening the file input
                        fileInput.click();
                    });

                    //DELETE CHANGES BUTTON
                    document.getElementById('optimizelyExtended-deleteChangesButton').addEventListener('click', function (event) {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Delete Changes Button Clicked'
                        });

                        //disabling button, adding spinner
                        //has to be done manually since element.disable=true doesn't for this UI button style
                        event.target.style.pointerEvents = 'none';
                        event.target.classList.add('lego-button--disabled');
                        event.target.innerHTML = `
                <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="spinner" class="svg-inline--fa fa-spinner axiom-icon axiom-icon--small fa-fw axiom-spinner fa-spin-pulse" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" color="hsla(227, 100%, 50%, 1)" data-test-section="button-spinner" style="padding: 0; margin: 0">
                    <path fill="currentColor" d="M208 48C208 21.49 229.5 0 256 0C282.5 0 304 21.49 304 48C304 74.51 282.5 96 256 96C229.5 96 208 74.51 208 48zM256 64C264.8 64 272 56.84 272 48C272 39.16 264.8 32 256 32C247.2 32 240 39.16 240 48C240 56.84 247.2 64 256 64zM208 464C208 437.5 229.5 416 256 416C282.5 416 304 437.5 304 464C304 490.5 282.5 512 256 512C229.5 512 208 490.5 208 464zM256 480C264.8 480 272 472.8 272 464C272 455.2 264.8 448 256 448C247.2 448 240 455.2 240 464C240 472.8 247.2 480 256 480zM96 256C96 282.5 74.51 304 48 304C21.49 304 0 282.5 0 256C0 229.5 21.49 208 48 208C74.51 208 96 229.5 96 256zM48 240C39.16 240 32 247.2 32 256C32 264.8 39.16 272 48 272C56.84 272 64 264.8 64 256C64 247.2 56.84 240 48 240zM416 256C416 229.5 437.5 208 464 208C490.5 208 512 229.5 512 256C512 282.5 490.5 304 464 304C437.5 304 416 282.5 416 256zM464 272C472.8 272 480 264.8 480 256C480 247.2 472.8 240 464 240C455.2 240 448 247.2 448 256C448 264.8 455.2 272 464 272zM142.9 369.1C161.6 387.9 161.6 418.3 142.9 437C124.1 455.8 93.73 455.8 74.98 437C56.23 418.3 56.23 387.9 74.98 369.1C93.73 350.4 124.1 350.4 142.9 369.1V369.1zM97.61 391.8C91.36 398 91.36 408.1 97.61 414.4C103.9 420.6 113.1 420.6 120.2 414.4C126.5 408.1 126.5 398 120.2 391.8C113.1 385.5 103.9 385.5 97.61 391.8zM74.98 74.98C93.73 56.23 124.1 56.23 142.9 74.98C161.6 93.73 161.6 124.1 142.9 142.9C124.1 161.6 93.73 161.6 74.98 142.9C56.24 124.1 56.24 93.73 74.98 74.98V74.98zM97.61 120.2C103.9 126.5 113.1 126.5 120.2 120.2C126.5 113.1 126.5 103.9 120.2 97.61C113.1 91.36 103.9 91.36 97.61 97.61C91.36 103.9 91.36 113.1 97.61 120.2zM437 437C418.3 455.8 387.9 455.8 369.1 437C350.4 418.3 350.4 387.9 369.1 369.1C387.9 350.4 418.3 350.4 437 369.1C455.8 387.9 455.8 418.3 437 437V437zM414.4 391.8C408.1 385.5 398 385.5 391.8 391.8C385.5 398 385.5 408.1 391.8 414.4C398 420.6 408.1 420.6 414.4 414.4C420.6 408.1 420.6 398 414.4 391.8z">
                    </path>
                </svg>
                Deleting
                `
                        //getting list of elements representing each change in the current variation/page rule
                        var changesList = document.querySelector('.optimizelyExtended-ImportExportChanges>ul')
                        let checkedChanges = [];

                        //checking if there are any changes currently
                        if (changesList.children.length == 0) {
                            //no changes in the current variation/page rule

                            window.optimizelyUIExtended.log({
                                type: 'info',
                                content: 'No Changes Found'
                            });

                            //creating info popup informing the user that there are no changes to export
                            createInfoPopup('No Changes Created. Create changes to Delete.');

                            //reenabling the button/breaking out of the function by returning
                            event.target.classList.remove('lego-button--disabled');
                            event.target.style.pointerEvents = 'auto';
                            event.target.innerHTML = `
                        Delete Selected Changes
                    `;
                            return;
                        }
                        else {
                            //there are changes in the current variation/page rule to export

                            window.optimizelyUIExtended.log({
                                type: 'debug',
                                content: 'Changes Found'
                            });

                            //getting the ID of the first change in the list
                            //this is used as an anchor change to determine which page rule changes are currently being looked at
                            //there is no reference to the page ID on the page, so we have to use the first change ID as a reference
                            var firstChangeID = changesList.children[0].getAttribute('data-table-row-id');

                            //getting list of elements with checked checkboxes
                            Array.from(changesList.children).forEach(change => {
                                if (change.children[0].checked) {
                                    checkedChanges.push(change.getAttribute('data-table-row-id'));
                                }
                            });

                        }

                        //sending message to background script to export changes

                        window.optimizelyUIExtended.log({
                            type: 'debug',
                            content: 'Sending Message to Service Worker to Fetch Changes'
                        });

                        chrome.runtime.sendMessage({
                            type: 'deleteVariationChanges',
                            experimentID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[2],
                            variationID: window.location.href.match(/variations\/(\d+)/)[1],
                            firstChangeID: firstChangeID,
                            requestedChanges: checkedChanges
                        }, function (response) {
                            if (response.success) {
                                //if the response from the service worker indicates that the changes were successfully imported, reload the page
                                window.location.reload();
                            }
                            else {
                                //failed to import changes for some reason, put that reason in an error popup
                                createErrorPopup(response.message);
                            }
                        });
                    });
                }
            }
        });
    }

    if (enabledFeatures.revertChanges) {
        window.optimizelyUIExtended.log({
            type: 'info',
            content: 'Revert Changes Feature Enabled'
        });

        //REVERT CHANGES Feature
        //checks for the presence and/or change to the change history table
        //injects the revert changes button if they aren't already there
        window.optimizelyUIExtended.observeElementChanges('[data-test-section="change-history-changes-table"] > tbody', element => {
            window.optimizelyUIExtended.log({
                type: 'debug',
                content: 'Change History Table Detected'
            });

            //making sure the URL matches the web history page
            try {
                const currentUrl = window.location.href;

                //add other history pages as needed (FX, project, etc)
                const webHistoryURLPattern = /^https:\/\/app\.optimizely\.com\/v2\/projects\/\d+\/experiments\/\d+\/history$/;
                var isWebHistoryMatch = webHistoryURLPattern.test(currentUrl);
                //var isFXHistoryMatch = fxHistoryURLPattern.test(currentUrl); //example of how to add another URL match

                if (isWebHistoryMatch) {
                    window.optimizelyUIExtended.log({
                        type: 'debug',
                        content: 'Detected Web History Page'
                    });

                    //getting the change rows from the table
                    var rows = element.children;

                    //checking if the revert button has already been injected
                    //checking for an instance of .optimizelyExtended-webRevertTableOption in the document
                    if (document.querySelector('.optimizelyExtended-webRevertTableOption')) {
                        //button has already been injected
                        window.optimizelyUIExtended.log({
                            type: 'debug',
                            content: 'Revert Button Already Injected, Skipping...'
                        });
                    }
                    else {
                        window.optimizelyUIExtended.log({
                            type: 'debug',
                            content: 'Revert Button Not Injected, Injecting for all History Rows...'
                        });

                        //adding the revert button to each row
                        for (let row of rows) {
                            window.optimizelyUIExtended.log({
                                type: 'debug',
                                content: 'Injecting Revert Option for History Item'
                            });

                            //getting the ID of the change using regex pattern
                            var changeID = row.getAttribute('data-test-section').match(/\d+$/)[0];

                            var liItem = document.createElement("li");
                            liItem.classList.add('lego-dropdown__item');

                            var divChild = document.createElement('div');
                            divChild.classList.add('link');
                            divChild.classList.add('lego-dropdown__block-link');
                            divChild.classList.add('optimizelyExtended-webRevertTableOption');
                            divChild.style.minWidth = '200px';
                            divChild.style.color = '#FF0000';
                            divChild.setAttribute('tabindex', "1");
                            divChild.id = changeID;
                            divChild.innerHTML = '<span id=' + changeID + '>Revert to This Change</span>';

                            liItem.appendChild(divChild);

                            row.children[4].children[0].children[0].children[1].appendChild(liItem);

                            document.getElementById(changeID).addEventListener('click', function (event) {
                                window.optimizelyUIExtended.log({
                                    type: 'info',
                                    content: 'Revert to Change Clicked'
                                });
                                //closing the dropdown
                                document.querySelector('.lego-dropdown-group.is-active').classList.remove('is-active');

                                //triggering the revert to change function
                                revertWebChanges(event.target.id);
                            });
                        };
                    }
                }
                // else if(isFXHistoryMatch) {
                //     //do something
                // }
                else {
                    window.optimizelyUIExtended.log({
                        type: 'info',
                        content: 'History Table Detected but URL Not Matched, Skipping...'
                    });
                };

            } catch (error) {
                window.optimizelyUIExtended.log({
                    type: 'error',
                    content: ('Error Injecting Revert Changes Buttons: ', error)
                });

                createErrorPopup(error);
            };
        });
    }

    if (enabledFeatures.copyNames) {
        window.optimizelyUIExtended.log({
            type: 'info',
            content: 'Copy Names Feature Enabled'
        });

        // Project Name Copy Button
        window.optimizelyUIExtended.observeElementChanges('[data-test-section="project-name"]', element => {

            window.optimizelyUIExtended.log({
                type: 'debug',
                content: 'Project Page URL Matched'
            });

            const currentProjectID = window.location.href.match(/projects\/(\d+)/)[1];
            const projectClass = Array.from(element.classList).find(cls => cls.startsWith('optimizelyUIExtended-projectID-'));
            const classProjectID = projectClass ? projectClass.split('-')[2] : null;

            if (currentProjectID == classProjectID && element.children.length > 1) {
                return;
            }

            element.classList = '';
            element.classList.add('epsilon');
            element.classList.add('truncate');
            element.classList.add('optimizelyUIExtended-projectID-' + currentProjectID);

            var projectName = element.innerHTML;

            element.innerHTML = `
                    <div class="optimizelyUIExtended-name">${projectName}</div>
                    <div class="optimizelyUIExtended-nameCopyButton optimizelyUIExtended-nameCopyButton-colorGrey">
                        <div class="optimizelyUIExtended-nameCopyButton-backgroundBlur optimizelyUIExtended-nameCopyButton-backgroundBlur-colorGrey"></div>
                        <div class="flex-self--end optimizelyUIExtended-nameCopyButton-button" style="display: inline;">
                            <div class="" title="">
                                <button class="oui-button oui-button--small oui-button--plain oui-button--default" type="button">
                                    <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="clipboard"
                                        class="svg-inline--fa fa-clipboard axiom-icon axiom-icon--small fa-fw" role="img"
                                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" color="hsla(241, 77%, 12%, 1)">
                                        <path fill="currentColor"
                                            d="M112 128h160C280.8 128 288 120.8 288 112S280.8 96 272 96h-24.88C252.6 86.55 256 75.72 256 64c0-35.35-28.65-64-64-64S128 28.65 128 64c0 11.72 3.379 22.55 8.877 32H112C103.2 96 96 103.2 96 112S103.2 128 112 128zM192 32c17.64 0 32 14.36 32 32s-14.36 32-32 32S160 81.64 160 64S174.4 32 192 32zM320 64c-8.844 0-16 7.156-16 16S311.2 96 320 96c17.64 0 32 14.34 32 32v320c0 17.66-14.36 32-32 32H64c-17.64 0-32-14.34-32-32V128c0-17.66 14.36-32 32-32c8.844 0 16-7.156 16-16S72.84 64 64 64C28.7 64 0 92.72 0 128v320c0 35.28 28.7 64 64 64h256c35.3 0 64-28.72 64-64V128C384 92.72 355.3 64 320 64z">
                                        </path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `

            window.optimizelyUIExtended.log({
                type: 'debug',
                content: 'Inner HTML Changed'
            });

            // container style
            element.style.position = 'relative';
            element.style.width = '100%';
            element.style.height = '2rem';

            // name style
            // add event listeners for mouseover and mouseout
            element.addEventListener('mouseover', function () {
                element.querySelector('.optimizelyUIExtended-nameCopyButton').style.display = 'block';
            });
            element.addEventListener('mouseout', function () {
                element.querySelector('.optimizelyUIExtended-nameCopyButton').style.display = 'none';
            });

            // copy button style
            if (enabledFeatures.copyNamesID) {
                element.querySelector('.optimizelyUIExtended-nameCopyButton-button').addEventListener('click', function (event) {

                    var projectName = document.querySelector('.optimizelyUIExtended-name').innerHTML;
                    // copy the project name

                    projectName = projectName + ' (' + window.location.href.match(/projects\/(\d+)/)[1] + ')';

                    navigator.clipboard.writeText(projectName).then(function () {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Project Name Copied to Clipboard'
                        });
                    }, function (err) {
                        window.optimizelyUIExtended.log({
                            type: 'error',
                            content: 'Failed to Copy Project Name to Clipboard'
                        });
                    });
                });
            }
            else {
                element.querySelector('.optimizelyUIExtended-nameCopyButton-button').addEventListener('click', function (event) {

                    var projectName = document.querySelector('.optimizelyUIExtended-name').innerHTML;
                    // copy the project name to the clipboard

                    navigator.clipboard.writeText(projectName).then(function () {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Project Name Copied to Clipboard'
                        });
                    }, function (err) {
                        window.optimizelyUIExtended.log({
                            type: 'error',
                            content: 'Failed to Copy Project Name to Clipboard'
                        });
                    });
                });
            }

        });

        // Web AB Experiment Name Copy Button
        //campaign
        //experiments
        //multivariate
        window.optimizelyUIExtended.observeElementChanges('[data-test-section="header-title"]', element => {

            if (/^https:\/\/app\.optimizely\.com\/v2\/projects\/\d+\/(experiments|multivariate|campaigns)\/\d+(\/\w+)?$/.test(window.location.href)) {
                window.optimizelyUIExtended.log({
                    type: 'debug',
                    content: 'Experiment Page URL Matched'
                });

                if (element.classList.contains('optimizelyUIExtended-modified')) {
                    return;
                }

                element.classList.add('optimizelyUIExtended-modified');

                var experimentName = element.innerHTML;

                element = element.parentElement;

                element.innerHTML = `
                    <h4 class="optimizelyUIExtended-name sidenav__header__title flush--bottom force-break gamma">${experimentName}</h4>
                    <div class="optimizelyUIExtended-nameCopyButton optimizelyUIExtended-nameCopyButton-colorWhite">
                        <div class="optimizelyUIExtended-nameCopyButton-backgroundBlur optimizelyUIExtended-nameCopyButton-backgroundBlur-colorWhite"></div>
                        <div class="flex-self--end optimizelyUIExtended-nameCopyButton-button" style="display: inline;">
                            <div class="" title="">
                                <button class="oui-button oui-button--small oui-button--plain oui-button--default" type="button">
                                    <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="clipboard"
                                        class="svg-inline--fa fa-clipboard axiom-icon axiom-icon--small fa-fw" role="img"
                                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" color="hsla(241, 77%, 12%, 1)">
                                        <path fill="currentColor"
                                            d="M112 128h160C280.8 128 288 120.8 288 112S280.8 96 272 96h-24.88C252.6 86.55 256 75.72 256 64c0-35.35-28.65-64-64-64S128 28.65 128 64c0 11.72 3.379 22.55 8.877 32H112C103.2 96 96 103.2 96 112S103.2 128 112 128zM192 32c17.64 0 32 14.36 32 32s-14.36 32-32 32S160 81.64 160 64S174.4 32 192 32zM320 64c-8.844 0-16 7.156-16 16S311.2 96 320 96c17.64 0 32 14.34 32 32v320c0 17.66-14.36 32-32 32H64c-17.64 0-32-14.34-32-32V128c0-17.66 14.36-32 32-32c8.844 0 16-7.156 16-16S72.84 64 64 64C28.7 64 0 92.72 0 128v320c0 35.28 28.7 64 64 64h256c35.3 0 64-28.72 64-64V128C384 92.72 355.3 64 320 64z">
                                        </path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `
                // container style
                element.style.position = 'relative';
                element.style.width = '100%';
                if (element.children[0].scrollWidth > element.children[0].clientWidth) {
                    element.style.height = '4rem';
                    element.children[0].style.whiteSpace = 'normal';
                    element.children[1].style.height = '4rem';
                    element.children[1].children[1].style.top = '1rem';
                }
                else {
                    element.style.height = '2rem';
                }

                // name style
                // add event listeners for mouseover and mouseout
                element.addEventListener('mouseover', function () {
                    element.querySelector('.optimizelyUIExtended-nameCopyButton').style.display = 'block';
                });
                element.addEventListener('mouseout', function () {
                    element.querySelector('.optimizelyUIExtended-nameCopyButton').style.display = 'none';
                });

                // copy button style
                if (enabledFeatures.copyNamesID) {
                    element.querySelector('.optimizelyUIExtended-nameCopyButton-button').addEventListener('click', function (event) {

                        var experimentName = document.querySelector('.optimizelyUIExtended-name').innerHTML;
                        // copy the experiment name

                        experimentName = experimentName + ' (' + window.location.href.match(/(experiments|multivariate|campaigns)\/(\d+)/)[2] + ')';

                        navigator.clipboard.writeText(experimentName).then(function () {
                            window.optimizelyUIExtended.log({
                                type: 'info',
                                content: 'Experiment Name Copied to Clipboard'
                            });
                        }, function (err) {
                            window.optimizelyUIExtended.log({
                                type: 'error',
                                content: 'Failed to Copy Experiment Name to Clipboard'
                            });
                        });
                    });
                }
                else {
                    element.querySelector('.optimizelyUIExtended-nameCopyButton-button').addEventListener('click', function (event) {

                        var experimentName = document.querySelector('.optimizelyUIExtended-name').innerHTML;
                        // copy the experiment name to the clipboard

                        navigator.clipboard.writeText(experimentName).then(function () {
                            window.optimizelyUIExtended.log({
                                type: 'info',
                                content: 'Experiment Name Copied to Clipboard'
                            });
                        }, function (err) {
                            window.optimizelyUIExtended.log({
                                type: 'error',
                                content: 'Failed to Copy Experiment Name to Clipboard'
                            });
                        });
                    });
                }
            }
        });

        // FX Feature Name Copy Button
        window.optimizelyUIExtended.observeElementChanges('[data-test-section="header-title"]', element => {
            if (/^https:\/\/app\.optimizely\.com\/v2\/projects\/\d+\/flags\/manage\/.*$/.test(window.location.href)) {

                window.optimizelyUIExtended.log({
                    type: 'debug',
                    content: 'Feature Page URL Matched'
                });

                if (element.classList.contains('optimizelyUIExtended-modified')) {
                    return;
                }

                var featureName = element.innerHTML;

                var parent = element.parentElement;

                elementIndex = Array.from(parent.children).findIndex(child => child.matches('[data-test-section="header-title"]'));
                parent.children[elementIndex] = document.createElement('div');
                element = parent.children[elementIndex];

                element.classList.add('optimizelyUIExtended-modified');

                element.innerHTML = `
                        <h4 class="optimizelyUIExtended-name sidenav__header__title flush--bottom force-break gamma">${featureName}</h4>
                        <div class="optimizelyUIExtended-nameCopyButton optimizelyUIExtended-nameCopyButton-colorWhite">
                            <div class="optimizelyUIExtended-nameCopyButton-backgroundBlur optimizelyUIExtended-nameCopyButton-backgroundBlur-colorWhite"></div>
                            <div class="flex-self--end optimizelyUIExtended-nameCopyButton-button" style="display: inline;">
                                <div class="" title="">
                                    <button class="oui-button oui-button--small oui-button--plain oui-button--default" type="button">
                                        <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="clipboard"
                                            class="svg-inline--fa fa-clipboard axiom-icon axiom-icon--small fa-fw" role="img"
                                            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" color="hsla(241, 77%, 12%, 1)">
                                            <path fill="currentColor"
                                                d="M112 128h160C280.8 128 288 120.8 288 112S280.8 96 272 96h-24.88C252.6 86.55 256 75.72 256 64c0-35.35-28.65-64-64-64S128 28.65 128 64c0 11.72 3.379 22.55 8.877 32H112C103.2 96 96 103.2 96 112S103.2 128 112 128zM192 32c17.64 0 32 14.36 32 32s-14.36 32-32 32S160 81.64 160 64S174.4 32 192 32zM320 64c-8.844 0-16 7.156-16 16S311.2 96 320 96c17.64 0 32 14.34 32 32v320c0 17.66-14.36 32-32 32H64c-17.64 0-32-14.34-32-32V128c0-17.66 14.36-32 32-32c8.844 0 16-7.156 16-16S72.84 64 64 64C28.7 64 0 92.72 0 128v320c0 35.28 28.7 64 64 64h256c35.3 0 64-28.72 64-64V128C384 92.72 355.3 64 320 64z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                `

                // container style
                element.style.position = 'relative';
                element.style.width = '100%';
                if (element.children[0].scrollWidth > element.children[0].clientWidth) {
                    element.style.height = '4rem';
                    element.children[0].style.whiteSpace = 'normal';
                    element.children[1].style.height = '4rem';
                    element.children[1].children[1].style.top = '1rem';
                }
                else {
                    element.style.height = '2rem';
                }

                // name style
                // add event listeners for mouseover and mouseout
                element.addEventListener('mouseover', function () {
                    element.querySelector('.optimizelyUIExtended-nameCopyButton').style.display = 'block';
                });
                element.addEventListener('mouseout', function () {
                    element.querySelector('.optimizelyUIExtended-nameCopyButton').style.display = 'none';
                });

                // copy button style
                element.querySelector('.optimizelyUIExtended-nameCopyButton-button').addEventListener('click', function (event) {

                    var featureName = document.querySelector('.optimizelyUIExtended-name').innerHTML;
                    // copy the experiment name to the clipboard

                    navigator.clipboard.writeText(featureName).then(function () {
                        window.optimizelyUIExtended.log({
                            type: 'info',
                            content: 'Experiment Name Copied to Clipboard'
                        });
                    }, function (err) {
                        window.optimizelyUIExtended.log({
                            type: 'error',
                            content: 'Failed to Copy Experiment Name to Clipboard'
                        });
                    });
                });
            }
        });
    }

    if (enabledFeatures.logLevel) {
        window.optimizelyUIExtended.setLogLevel(enabledFeatures.logLevel);
    }
    else {
        console.error('Unable to Find Log Level in Local Storage');
    }

    window.optimizelyUIExtended.log({
        type: 'info',
        content: 'Optimizely Changes Extension Injected'
    });

}).catch(error => {
    window.optimizelyUIExtended.log({
        type: 'error',
        content: ('Error Injecting Extension: ', error)
    });

    createErrorPopup(error);
});







