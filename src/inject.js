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
    log: {},
    setLogLevel: function (level) {
        switch (level) {
            case 'full':
                window.optimizelyTransferChanges.log = function (message) {
                    message.content = '[Optimizely Transfer Changes Extension] ' + message.content;
                    if (message.type === 'error') {
                        console.error(message.content);
                    }
                    else {
                        console.log(message.content);
                    }
                };
                break;
            case 'debug':
                window.optimizelyTransferChanges.log = function (message) {
                    message.content = '[Optimizely Transfer Changes Extension] ' + message.content;
                    if (message.type === 'error') {
                        console.error(message.content);
                    }
                    else if (message.type === 'all') {
                        //do nothing
                    }
                    else {
                        console.log(message.content);
                    }
                };
                break;
            case 'info':
                window.optimizelyTransferChanges.log = function (message) {
                    message.content = '[Optimizely Transfer Changes Extension] ' + message.content;
                    if (message.type === 'error') {
                        console.error(message.content);
                    }
                    else if (message.type === 'info') {
                        console.log(message.content);
                    }
                };
                break;
            case 'error':
                window.optimizelyTransferChanges.log = function (message) {
                    message.content = '[Optimizely Transfer Changes Extension] ' + message.content;
                    if (message.type === 'error') {
                        console.error(message.content);
                    }
                };
                break;
            case 'none':
                window.optimizelyTransferChanges.log = function (message) {
                    //do nothing
                };
                break;
            default:
                window.optimizelyTransferChanges.log = function (message) {
                    message.content = '[Optimizely Transfer Changes Extension] ' + message.content;
                    if (message.type === 'error') {
                        console.error(message.content);
                    }
                };
                break;
        }
    },
    getUUID: function () {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
};
//--------End Global Variables--------

function getPendingSetPages(){
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


//-----------------Main Code-----------------
//executes when the script is injected
window.optimizelyTransferChanges.setLogLevel('debug');

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
    if(element.innerHTML.includes('Switching to Saved Pages will discard changes') && (!element.classList.contains('optimizely-transfer-changes-popup_marker'))) {

        //need this to not reapply changes over any over, again, idk why lol
        element.classList.add('optimizely-transfer-changes-popup_marker');
        
        var popupParent = element.parentElement.parentElement.parentElement.parentElement;
        
        window.optimizelyTransferChanges.log({
            type: 'info',
            content: 'Targeting Change Type Popup Detected'
        });

        //modifying text
        popupParent.querySelector('[data-test-section="confirm-message"]').innerHTML =`
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

        //adding Transfer Changes Button

        var transferChangesButton = document.createElement('button');
        transferChangesButton.type = 'submit';
        transferChangesButton.classList.add('lego-button', 'lego-button--highlight');
        transferChangesButton.setAttribute('data-test-section', 'confirm-submit-button');
        transferChangesButton.innerHTML = 'Transfer Changes to Page Targeting Rules';
        transferChangesButton.addEventListener('click', function(){
            let selectedPages = [];
            ul.querySelectorAll('input[name="page"]:checked').forEach(checkbox => {
                selectedPages.push(checkbox.value);
            });

            let pendingPages = [];
            ul.querySelectorAll('input[name="page"]').forEach(checkbox => {
                pendingPages.push(checkbox.value);
            });
            
            chrome.runtime.sendMessage({
                type: 'transferChanges',
                allPages: pendingPages,
                pages: selectedPages,
                experimentID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[2],
                projectID: window.location.href.match(/projects\/(\d+)\/experiments\/(\d+)/)[1]
            },
            function(response){
                if (response.success) {
                    window.location.reload();
                } else {
                    console.log(response);
                    window.optimizelyTransferChanges.log({
                        type: 'error',
                        content: 'Failed to transfer changes'
                    });
                }
            });
        });

        popupParent.querySelector('.lego-dialog__footer.lego-button-row--right').appendChild(transferChangesButton);
    }
});