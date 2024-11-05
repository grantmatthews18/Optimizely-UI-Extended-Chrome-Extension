//----------Global Variables----------
//global object for storing data
window.optimizelyTransferChanges = {
    //functions
    observeElementChanges: function (selector, callback) {
        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                callback(document.querySelector(selector));
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
                console.error('[Optimizely Transfer Changes Extension]', log.content);
            }
            else {
                console.log('[Optimizely Transfer Changes Extension]', log.content);
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
    var errorPopup = document.createElement('div');
    errorPopup.classList.add('dialog--wrapper', 'dialog--shown'); 
    errorPopup.style.zIndex = '3000';
    errorPopup.innerHTML = `
        <div class="dialog dialog--shadow">
            <div class="lego-dialog__close optiExtensionCloseButton" data-test-section="standard-dialog-close">
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
                        <p> ${message}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    //event listener for close button
    errorPopup.querySelector('.optiExtensionCloseButton').addEventListener('click', function (event) {
        window.location.reload();
    });

    //clearing all existing dialogs
    dialogManager = document.querySelector('#root').querySelector('#dialog-manager');
    dialogManager.querySelectorAll('[data-test-section="dialog-frame"]').forEach(child => child.remove());
    dialogManager.appendChild(errorPopup);
}
//--------End Functions--------


//-----------------Main Code-----------------
//executes when the script is injected
window.optimizelyTransferChanges.setLogLevel('debug'); //THIS CAN BE CHANGED TO 'full', 'debug', 'info', 'error', OR 'none'
//this should be set via an option somewhere or via a JS function 

window.optimizelyTransferChanges.log({
    type: 'info',
    content: 'Optimizely Changes Extension Injected'
});

//checks for the presence and/or change to the change history table
//injects the revert changes button if they aren't already there
window.optimizelyTransferChanges.observeElementChanges('.lego-dialog__title.flush--bottom', element => {
    window.optimizelyTransferChanges.log({
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

        window.optimizelyTransferChanges.log({
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
        window.optimizelyTransferChanges.log({
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

        window.optimizelyTransferChanges.log({
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

        window.optimizelyTransferChanges.log({
            type: 'debug',
            content: 'Transfer Changes Button Added'
        });

        //event listener for transfer changes button
        transferChangesButton.addEventListener('click', function (event) {

            window.optimizelyTransferChanges.log({
                type: 'info',
                content: 'Transfer Changes Button Clicked'
            });

            //disabling buttons
            let buttonContainer = event.target.parentElement;
            buttonContainer.querySelectorAll('*').forEach(child => {
                child.disabled = true;
            });

            window.optimizelyTransferChanges.log({
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

            window.optimizelyTransferChanges.log({
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

            window.optimizelyTransferChanges.log({
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

                        window.optimizelyTransferChanges.log({
                            type: 'info',
                            content: 'Changes Transferred Successfully. Reloading Page...'
                        });

                        window.location.reload();
                    }
                    else {

                        window.optimizelyTransferChanges.log({
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