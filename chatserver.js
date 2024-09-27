const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username-input');
const sendBtn = document.getElementById('send-btn');
sendBtn.hidden = true;
let latestId = -1;
const updateInterval = 2000;

// Function to generate a random light color based on the username
function generateUsernameColor(username) {
    if (!username) {
        return "#fff";
    } 
    // Create a simple hash from the username
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Convert the hash to an HSL color
    const h = hash % 360;
    const s = hash % 100;
    const l = 60 + hash % 10;
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function formatDate(utctime) {
    const date = new Date(utctime * 1000);
    
    return date.toLocaleString(undefined, {
        // year: '2-digit',
        // month: '2-digit',
        // day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(',', '');
}

// Automatically adjust the height of the textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';  // Reset the height
    messageInput.style.height = messageInput.scrollHeight + 'px';  // Set new height
}

// Attach event listener to the textarea to adjust height on input
messageInput.addEventListener('input', autoResizeTextarea);

// Function to send message on Enter key press
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent adding new lines
        sendMessageHandler(); // Trigger send message when Enter is pressed
    }
});

async function getLatestMessageId() {
    const response = await fetch(`${url}?len`);
    if (response.ok) {
        return +(await response.text());
    }
    return null;
}

// Fetch messages starting from a specific id
async function getMessagesFrom(id) {
    const response = await fetch(`${url}?from=${id}`);
    if (response.ok) {
        return await response.text();
    }
    return null;
}

// Send a new message (without message ID since server assigns it)
async function sendMessage(content) {
    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: content
    });
    return response.ok;
}

function notifyNewMessage() {
    if ("Notification" in window) {
        // Request permission to show notifications
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            // Create a new notification
            const notification = new Notification("New Message!", {
              body: "There are new messages",
            });
          }});
      }
}

function addQuoteEvents(div, id) {
    username = div.getElementsByClassName('username')[0];
    username.addEventListener('click', function() {
        messageInput.value += ` #${id} `;
    });
    div.classList.add("highlight");
}


let currentHighLight;
function toQuote(id){
    const div = document.getElementById(`msg_${id}`);
    if (!div) return;
    if (currentHighLight)
        currentHighLight.classList.remove("highlight");
    div.style.border = "1px solid #888";
    currentHighLight = div;
    chatBox.scrollTop = div.offsetTop;
}

function wrapQuoteEvent(text) {
    // Regular expression to find #{id} pattern
    const idPattern = /#(\d+)/g;

    // Replace each #{id} with a span containing the onclick event
    return text.replace(idPattern, (match, id) => {
        return `<span class="tag" onclick="toQuote('${id}')">#${id}</span>`;
    });
}


function escapeRegExp(string) {
    // return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return string.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  }

function extractFilenameFromUrl(url) {
    // Regular expression to match URLs starting with https://uploadurl/, followed by somecache, and ending with filename
    const pattern = `${escapeRegExp(fileUploadUrl)}[a-zA-Z0-9]+\/([^\/\\s]+)`;

    
    // Execute the regex to find and capture the filename
    const match = url.match(pattern);
    
    // If a match is found, return the captured filename (the part after /somecache/)
    if (match && match[1]) {
      return match[1];
    }
    
    // Return null or an empty string if no match is found
    return null;
  }

function wrapURLs(text) {
    const urlPattern = /(https?:\/\/[a-zA-Z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+)/g;
    return text.replace(urlPattern, function(url) {
        let display_url = extractFilenameFromUrl(url);
        if (!display_url) display_url = url;
        return `<a href="${url}" target="_blank">${display_url}</a>`;
    });
}

function escapeHTML(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;' // for single quotes, if needed
    };
    return str.replace(/[&<>"']/g, function(match) {
      return map[match];
    });
  }
  

function scrollToBottom(){
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Load messages starting from the latest message id
let updating = false;
async function updateMessages(notify=true, recursive=false) {
    if (!updating) {
        updating = true;
        let currentId = await getLatestMessageId() - 1;
        if (currentId && (latestId < currentId)) {
            const scrolledToBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 50;
            let messages = await getMessagesFrom(latestId + 1);
            if (messages) {
                addMessages(messages, notify=notify);
                latestId = currentId;
                if (scrolledToBottom) {
                    scrollToBottom();
                }
            }
        }
        updating = false;
    }
    if (recursive) 
        setTimeout(updateMessages, updateInterval, notify, recursive);
}

// Append messages to the chat box
let last_username;
function addMessages(messages, notify=true) {
    const messages_list = messages.split("\r");
    messages_list.forEach((message) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        // Separate the first word as message ID, and then split the remaining message
        const messageParts = message.split(' ');
        const messageId = messageParts[0];  // First word is the message ID
        let content = messageParts.slice(3).join(' ');  // Rest of the message

        messageDiv.id = `msg_${messageId}`

        // Split the rest of the message into content, username, and timestamp
        const timestamp = +(messageParts[1]);  // Last token is the timestamp
        const username = messageParts[2];  // Second to last token is the username

        if (notify && username !== usernameInput.value.trim()) notifyNewMessage();
        // Create the meta-info div (Message ID, Username, Timestamp in one line)
        const metaInfoDiv = document.createElement('span');
        metaInfoDiv.classList.add('meta-info');

        const usernameDiv = document.createElement('span');
        usernameDiv.classList.add('username');
        usernameDiv.innerText = username;

        const timestampDiv = document.createElement('span');
        timestampDiv.classList.add('timestamp');
        const timestr = formatDate(timestamp);
        timestampDiv.innerText = timestr;

        metaInfoDiv.appendChild(usernameDiv);
        metaInfoDiv.appendChild(timestampDiv);

        // Create the content div (Message content in separate lines)
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');
        content = escapeHTML(content);
        content = wrapQuoteEvent(content);
        content = wrapURLs(content);
        contentDiv.innerHTML = content;

        // Append the meta-info and content to the message div
        messageDiv.appendChild(metaInfoDiv);
        messageDiv.appendChild(contentDiv);

        addQuoteEvents(messageDiv, messageId);

        // Set random light background color based on the username
        const backgroundColor = generateUsernameColor(username);
        usernameDiv.style.color = backgroundColor;

        if (username !== last_username)
            chatBox.appendChild(document.createElement('hr'));
        chatBox.appendChild(messageDiv);
        last_username = username;
    });
}

// Handle send button click
sendBtn.addEventListener('click', sendMessageHandler);
messageInput.addEventListener('input', function() {
    if (messageInput.value == '') {
        sendBtn.hidden = true;
        fileSelect.hidden = false;
    } else {
        sendBtn.hidden = false;
        fileSelect.hidden = true;        
    }
}
);

// Function to handle message sending
let isSending = false;
async function sendMessageHandler(e) {
    // e.preventDefault();
    if (isSending) return;
    isSending = true;
    const username = usernameInput.value.trim();  // Get the username
    const content = messageInput.value.trim();    // Get the message
    if (content !== '' && username !== '') {
        // Send the message content and username (server assigns the message ID)
        const fullMessage = `${username} ${content}`;  // Message content, username, and timestamp
        const success = await sendMessage(fullMessage);
        if (success) {
            messageInput.value = '';  // Clear input
            messageInput.focus();
            autoResizeTextarea();  // Reset the textarea height
            await updateMessages();     // Load new messages
            scrollToBottom();
            sendBtn.hidden = true;
            fileSelect.hidden = false;
        } else {
            alert('Failed to send message');
        }
    } 
    isSending = false;
}


// Poll for new messages every 2 seconds
updateMessages(notify=false);
setTimeout(updateMessages, updateInterval, true, true);

const fileSelect = document.getElementById("fileSelect");
const fileElem = document.getElementById("fileElem");

const uploadingBar = document.createElement("div");
uploadingBar.innerText = "Uploading...";
uploadingBar.hidden = true;
const inputSection = messageInput.parentElement;
inputSection.appendChild(uploadingBar);

function uploadingBarStart(){
    uploadingBar.hidden = false;
    messageInput.hidden = true;
    fileSelect.hidden = true;
    sendBtn.hidden = true;
}

function uploadingBarFinish(){
    uploadingBar.hidden = true;
    messageInput.hidden = false;
    fileSelect.hidden = true;
    sendBtn.hidden = false;
}

async function readFile(file) {
    const blob = file.slice(0, file.size);  // Read the entire file
    const arrayBuffer = await blob.arrayBuffer();  // Read it as an ArrayBuffer
    return arrayBuffer
}

async function uploadFile(file) {
    const response = await fetch(fileUploadUrl, {
        method: 'POST',
        mode: 'cors',
        body: await readFile(file),
    });

    if (response.ok) {
        const hash = await response.text();
        return hash + '/' + file.name;  // Assuming server returns the file URL
    } else {
        return null;
    }
}


fileElem.style.display="inline";
// fileElem.style.visibility="hidden";
fileElem.style.opacity = 0;
fileElem.style.position = "absolute";
fileElem.style.left = "-9999px";
fileElem.style.width = "1px";
fileElem.style.height = "1px";
fileElem.style.zIndex = -1;

fileElem.addEventListener('change', async function() {
    const file = fileElem.files[0];
    if (file) {
        uploadingBarStart();
        fileUrl = await uploadFile(file);
        if (fileUrl) {
            messageInput.value += `${fileUploadUrl}${fileUrl}\n`;
            sendBtn.hidden = false;
            fileSelect.hidden = true;
        } else {
            alert('File upload failed');
        }
        uploadingBarFinish();
    }
});

fileSelect.addEventListener(
    "click",
    (e) => {
      if (fileElem) {
        fileElem.click();
      }
    },
    false,
);