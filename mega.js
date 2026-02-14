import * as mega from "megajs";
import fs from "fs";

// Mega authentication credentials (old style)
const auth = {
    email: "mrkhan.khilari.420@gmail.com",
    password: "qryDV!:.Lz_.e3K",
    userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
};

// Upload function (stream-based, old behavior retained)
export const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            const storage = new mega.Storage(auth, (err) => {
                if (err) return reject(err);

                const uploadStream = storage.upload({ name: name, allowUploadBuffering: true });
                data.pipe(uploadStream);

                storage.on("add", (file) => {
                    file.link((err, url) => {
                        if (err) return reject(err);
                        storage.close();
                        resolve(url);
                    });
                });

                uploadStream.on("error", (error) => reject(error));
                data.on("error", (error) => reject(error));
            });

            storage.on("error", (error) => reject(error));
        } catch (err) {
            reject(err);
        }
    });
};

// Download function
export const download = (url) => {
    return new Promise((resolve, reject) => {
        try {
            const file = mega.File.fromURL(url);

            file.loadAttributes((err) => {
                if (err) return reject(err);

                file.downloadBuffer((err, buffer) => {
                    if (err) reject(err);
                    else resolve(buffer);
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};
