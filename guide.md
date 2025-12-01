How Video Editors Implement Timeline Filmstrips Using FFmpeg and JavaScript
The complete guide
Aditya Krishnan
Aditya Krishnan

Follow
15 min read
·
Apr 10, 2023
156


2





Press enter or click to view image in full size

Image from freepik
Hi there, everyone. I wanted to discuss a niche topic today. Something I have recently been working on. Filmstrips— and how major online video editors like Kapwing, Clipchamp, Veed, Canva, etc., generate and strategize filmstrips on their editors. Let’s begin, shall we?

What are Filmstrips?
Let’s start from the bottom. Filmstrips, what are they? No, I am not talking about spooled rolls used in analog cameras a few decades ago, but something that is surely inspired by it. Have you ever wandered around on a video editor? If you have, you know that the bottom half of an editor usually encompasses a “timeline” of sorts. It has a ruler grid looking like a number line at the top and stacks a bunch of rectangular blocks below it.

These blocks or layers give you minute control over an element’s temporal visibility, allowing you to slide or resize them horizontally along a linear number line. This number line generally represents the time in seconds. A layer’s length is its duration, and its placement signifies an element’s start and end times. Something like this:


Credits: Veed.io
As you can see, the four layers above represent an element of a particular type. The orange layer labeled “Hand Write” is a text layer that starts somewhere before the 30-second mark and ends after the 60-second mark. The same goes for every layer. But if they are just blocks like these, where do filmstrips come in? Wait, we haven’t gotten there. You don’t see any video layers in the above image. Let me show you what they look like on a timeline.


Credits: Veed.io
Tada! A video has appeared with a complimentary filmstrip! A series of images stitched side-by-side to represent specific keyframes in a video. Now, let’s see why.

Why Filmstrips?
How do filmstrips enhance my editing experience? Well, the answer is two-fold.

It makes identification easier. Due to the frames of the video appearing on the layer, you instantly know which video layer you are working with no need to look for names, serial numbers, etc.
Secondly, trimming and splitting! If you split a single long video into multiple parts, you know which part is what just by looking at the frames. It makes the rearrangement of such layers a breeze.
Now that you know how resourceful these tiny strips of images are, I want to share how major video editors make and utilize them on the web.

Filmstrips, The How
The million-dollar question! If a developer like myself is tasked to make a filmstrip and make it work on a timeline like this — what would I do? Before I answer this, let me tell you how native and online applications differ in this respect.

Native Video Editing Applications
For context, a native application is built specifically for use on a particular platform or OS. These are standalone applications that directly run on your computer. Some of the well-known examples are Adobe products like Premier Pro or others like Final Cut Pro and iMovie. Any apps installed on your mobile devices are also native, such as Inshot or Lumafusion.

Online Video Editors
Where would it be if something claims to be “online” or “on the cloud” and is not already an application on your device? That’s right, your browser. Let’s talk about what browser-based video editors like Kapwing, Clipchamp, Veed, etc., have to do differently to create and manage filmstrips.

Creating a Filmstrip
A simple way to create a filmstrip out of a video is to use FFmpeg and execute a simple command. For context, FFmpeg is a well-known open-source project for processing multimedia files. It exists primarily as a command-line tool and is extremely powerful.

Installing FFmpeg
To install FFmpeg, you download it from their website. https://ffmpeg.org/download.html

Mac users could alternatively type brew install ffmpeg in their terminals.

The magic command
If I wanted to make a filmstrip consisting of 1 row and N columns with a frame extracted every 800 frames. A simple command like the following could generate it in a second:

ffmpeg -i input.mp4 -frames 1 -vf "select=not(mod(n\,800)),scale=100:-2,tile=10x1" output.png -y
I’ll explain this command.

-i signifies the input file.

-frames 1 tells FFmpeg that even though I am requesting multiple frames to be extracted, I want only one image as an output.

-vf is defining a "filtergraph." A bunch of filters is applied to the input.

select=not(mod(n\,800)) signifies selecting one frame every 800 frames.
scale=100:-2 is scaling down every frame to 100 pixels in width and the height to the respective ratio but keeping it a multiple of two, hence the -2.
tile=10x1 means layout extracted frames in this grid. It also tells that only ten frames are arranged in that grid. FFmpeg, unfortunately, needs an exact number for this grid. It can only keep laying it out once frames are extracted. Instead, you can find the number of total frames that exist in a video and give a number based on that.
-y Override any existing output file.

And this is what your filmstrip would look like. Just take this and place it over a video layer, and you are good to go.


You can also use the same logic to make a 5x5 mosaic out of it.

ffmpeg -i input.mp4 -frames 1 -vf "select=not(mod(n\,300)),scale=100:-2,tile=5x5" output.png -y

’Tis Only the Beginning
If generating a filmstrip is so simple, why should online editors specifically fuss over it? Because FFmpeg runs on a command line that essentially uses the resources of an OS. But I can do all this on a server and just send the image back to the browser, right? Of course, but that’s when the cracks start showing. Will the user be waiting for the filmstrips to generate every time? What if the user trims a video layer? Can the filmstrip show the correct frames? Is there a way to generate such frames in the browser itself? It’s just the tip of the iceberg.

But as I said, browsers are incredibly advanced, so of course, they have a solution to all of these problems. You just have to tweak the delivery a little and add a bit more spice. I’ll discuss all these techniques and reverse engineer major video editors like Kapwing, Clipchamp, Veed, WeVideo, Canva, etc., to show how they achieve filmstrips individually in the next part!

Filmstrips and Zoom
Professional video editors have complex use cases on the timeline; a filmstrip falls under that. A timeline can zoom, a layer can be split, there are network constraints and many more. How do they handle these? Canva, WeVideo, Clipchamp, and Veed.io all have their approaches to solving these.

What do you mean by Zoom? Editor timelines can usually increase or decrease their time precision using zooms. Something like this:


To handle such zoom, simply placing a filmstrip on a layer would not work for video editors. A layer that has been zoomed in could have one frame repeated multiple times since the time frame over a certain area is much smaller. A generated filmstrip is constrained by the number of frames it has generated at arbitrary intervals.

For example, for a 100-second video, a generated filmstrip has ten frames in it captured every ten seconds, with each frame being 100 pixels in width. But since a zoomed-in layer could have a precision of 1 second for every 100 pixels, I will be showing the first frame at least ten times in succession to keep the frame of reference accurate.

Or if the layer has a precision of 20 seconds for every 100 pixels, I will have to show every alternate frame from my filmstrip to keep it accurate.

Because of this, a generated filmstrip can be directly placed on a layer under two very specific conditions:

The width of the filmstrip image must match the width of the layer.
The layer must exactly represent the time for which the frames were generated. This means it should start and end exactly so the frames remain accurate.
This means as soon as a user zooms in, the layer on the screen will be stretched, and the filmstrip will have no more frames to show, and the rest of the layer will remain empty. Or if they zoom out, the layer will shrink, and the filmstrip will cut before it reaches some of the final frames.

This brings inaccuracy to the portrayal of a video layer’s filmstrip, thus defeating its purpose. If generated filmstrips work only under specific conditions, what is the point of making them?

How Do Video Editors Use Filmstrips?
Let’s discuss how professional video editors place such generated filmstrips in sync with their timelines.

Placement techniques
Technique 1 — background image and background position
Editors like WeVideo and Flixier use a CSS-based approach to place these generated filmstrips in their layers.

background-image is a CSS property that allows you to place an image as the background of a div element. It is similar to keeping an img element inside a div element, but the advantage is that you can specify multiple images in a single background-image property. For instance, this is a valid background-image property value.

background-image: url(.../abc.png),url(.../def.png),url(.../ghi.png);
But which image will it show if listed like this? It will only use the image in the first url(). So, what's the advantage? If you combine this with background-size and background-position, you can mention the position of each image inside a defined space. Let me show you:

background-image: url(.../abc.png),url(.../abc.png),url(.../abc.png);
background-size: 150px 50px;
background-position: 0px 0px,50px -50px,100px -100px;
background-repeat: 'no-repeat'; // Since default is 'repeat'
In the above snippet,

I am using the same image multiple times in background-image.
With background-size you are defining that each image has a size of 150px width and 50px height. If you want to define a different size for each background, you can do it with comma-separated values.
With background-position, you are defining the left and top position of each image in background-image. The first image should be placed at the 0px top and 0px left position. The second image should be placed at 100px left and -50px top, and so on.
This kind of placement generally would look something like this:


But wait, the filmstrips are outside the layer, so how are they visible? You are right; they aren’t. And even if we keep top as 0px, the first image would stack above the other images. So what's the point of this approach?

Become a member
For this approach to work, we need the filmstrips to be generated vertically instead of horizontally. Something like this:


Now with the same CSS, we’ll get the following:


And there you go, you control individual frames on a layer. You can repeat or skip as many frames as you want. All of this is possible with a single filmstrip image. This way, you have decoupled the time constraint between a layer and a filmstrip. As long as you know the dimensions and intervals at which the frames were captured on a generated filmstrip, you can select a particular frame for portraying on a timeline layer.

If the layer is stretched out, you can repeat frames from the filmstrip like this:

background-image: url(.../abc.png),url(.../abc.png),url(.../abc.png),url(.../abc.png),url(.../abc.png),url(.../abc.png);
background-size: 150px 50px;
background-position: 0px 0px,0px 0px,50px -50px,50px -50px,100px -100px,100px -100px;
background-repeat: 'no-repeat';

Technique 2 — img tag
Editors like Canva use img elements to place filmstrips on their layers. For the above approach, you only need a single div with background-image and you can position the entire filmstrip. But if you find that cumbersome and need more granular control over each frame, you can do it like Canva.

Canva uses a 6x5 mosaic as a filmstrip and uses an img element for each frame on the layer. It uses basic CSS properties like position, top, and left to adjust the mosaic inside the img element. Canva's mosaic looks like this.


It places this mosaic inside the img element with position: absolute and respective left and top to show exactly the frame it wants to at that point on the layer. Something like this:

position: absolute;
height: 600%;
width: 500%;
left: -400%;
top: -100%;

Technique 3 —Background-image and background-repeat
Editors like Clideo don’t generate a single filmstrip image but generate individual frames as separate images. This means they capture frames at intervals but don’t stitch them into a single image rather they keep them separate. Now they use multiple div elements on the layer, each with background-image and background-repeat to load frames into them.

background-image: url(.../abc.png);
background-repeat: 'repeat-x';

Here they put a repeat-x on the background and keep repeating the background for stretched-out layers. They keep the div width exactly such that they don't cut off the frames that are on repeat. And voila!

Technique 4 — canvas element
Editors like Wave.video, Veed.io, Clipchamp, Kapwing, Capcut, etc., use the canvas element to place their filmstrips. Since they cannot be inspected or reverse-engineered from the DOM directly, there is no way to know for sure, but they are most probably applying one of the above techniques to get their result and place them inside a canvas.

The Constraints of “Online”
Before we begin, let’s see what challenges online video editors face while competing with native applications. Since native applications have direct access to the file system and run on the OS, they have instant access to every file (that the user can access). With complete control over files, native applications can extract frames from videos in a jiffy.

They can extract how much ever and whenever without any performance jitter at all. They can place every single frame of a two-hour-long video side by side in a second if they want to. That’s the amount of processing power and data flexibility they possess. See how Final Cut Pro can give options relating to the intervals of frames to display.


Why can’t we do this with online video editors as well? Let’s see.

Internet speed
We know how the internet varies for everyone: by speed! Someone with a fiber connection can get a gigabyte of data in a second, but there are people working with ten megabytes per second of data as well. This means there are different wait times for the same file for different consumers, introducing a time constraint.

Limited data
I also want to point out that many consumers are on limited data based on how internet plans in their regions are priced; they can’t keep using data as they will. Once they run out of their allotted data, their internet speeds are dropped to the lowest possible speed that can pass as alive, but good luck trying to get any data from it. This introduces a constraint on the amount of data downloaded.

Workflows
There are levels to which you can either choose to handle or ignore these problems. Let’s start with the workflows, and you’ll understand them. There are four major types of workflows adopted by online editors:

Backend-only approach
Backend and faux frontend approach
Backend and frontend approach
Frontend-only approach
Backend-only approach
This is the most straightforward approach. We learned how to generate filmstrips in the first part. Video editors use servers to generate them behind the curtains. As soon as they are generated, they send it to the browser and fill it on the timeline layer using techniques we saw in the second part. Till that moment, the timeline is going to be empty. No filling the time gaps. Nothing.

Backend and faux frontend approach
In this approach, editors try to fill the time gap to generate a filmstrip. They do this by extracting a single frame on the frontend and using it repeatedly as a filmstrip till the real filmstrip arrives. But how do they extract it? You can do it using the canvas element. Let me show you a snippet:

const generateVideoThumbnail = (src) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");

video.autoplay = true;
    video.muted = true;
    video.src = src;
    video.crossOrigin = "anonymous";
    video.onloadeddata = async () => {
      let ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      video.pause();
      const dataUrl = canvas.toDataURL("image/png")
      const blob = await (await fetch(dataUrl)).blob();
      const blobUrl = URL.createObjectURL(blob);
      resolve(blobUrl);
    };
  });
};
Now, what’s happening here?

I made a function generateVideoThumbnail which can get you the first frame of a video. Inside the function, I make a canvas and a video element, I set certain properties of the video and attached the onloadeddata listener to the video.

Why onloadeddata ? Because onloadeddata will trigger only when the first frame of the video has been fetched. Now that I know that the first frame of the video is loaded, I need to get this frame in an image form.

I get the image URL using the canvas element. You can draw the entire video inside the canvas using the drawImage function and then ask the canvas to get the URL of what it painted by using the function. And there you go!

You have the first frame of the video in a URL. But this URL will be huge since it is a base64 URL, which means it contains all the image data. But I can instead make a URL that only points to this data. I convert this to a blob and generate a blob URL.

I can place this URL as the background-image of a div element and use the background-repeat property to show it infinitely. Like this:

background-image: url(BLOB_URL);
background-repeat: 'repeat-x';
Press enter or click to view image in full size

Backend and frontend approach
We’ve seen the faux frontend approach above by using only one frame to fill the time gap. But if you want the user to have a peak editing experience, you can extend the faux approach by extracting all the relevant frames just like FFmpeg does. To get all frames, you need to download the entire video before extracting frames from it. To do that, you have to download the video using fetch() and then make a blob URL out of it. Like this:

const getBlobUrl = async () => {
  const blobUrl = URL.createObjectURL(
      await (await fetch(YOUR_VIDEO_URL)).blob()
  );
  return blobUrl;
}
After this, you can extract frames by altering the code for generateVideoThumbnail() a little. Like this:

const generateVideoThumbnails = (src) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const video = document.createElement("video");

      video.autoplay = true;
      video.muted = true;
      video.src = src;
      video.crossOrigin = "anonymous";

      const frames = [];

      video.onloadeddata = async () => {
        let ctx = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        video.pause();

        /**
        * For loop here!
        */
        for (let i = 0; i < 10; i++) {
          video.currentTime = i;
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
          const dataUrl = canvas.toDataURL("image/png");
          const blob = await (await fetch(dataUrl)).blob();
          const blobUrl = URL.createObjectURL(blob);
          frames.push(blobUrl);
        }

        resolve(frames);
      };
    });
  };
In the above function, I have just changed the part where we get one frame by putting it inside a for loop to seek and push frames to an array. I have an array with all the frames at the end of the loop.

You can use these frames to place them on the timeline layer till the real filmstrip arrives, and voila! You have peak editing experience where the layer will always have a filmstrip!

Frontend-only approach
Since you now know how to extract frames using Javascript, you can entirely skip the backend process of generating filmstrips and do it on the frontend. But you have to keep in mind a few things.

To extract frames, you need the video to be readily available. That means you must download the video every time a page is refreshed, putting limited data users at stake. You can optimize this by implementing a good caching strategy for video files.

Generated filmstrips are always easier to cache though. Since they will be a few megabytes at max, you can save plenty of cache room.

My Preference
I prefer the backend and frontend approach since, in the first use, I can make frames out of the video file directly since the user just uploaded it, and I don’t have to download anything. Concurrently, you generate the filmstrip for future use such that when the user refreshes the page, I only have to download the generated filmstrip.

Conclusion
It has been a long journey, but we have thoroughly explored filmstrips in online video editors. All my readers got to learn something new about video editors and filmstrips. And for those developers who want to implement their version of filmstrips, I hope all these points helped you make an informed decision to implement filmstrips in your editor.

Thank you! 😄


