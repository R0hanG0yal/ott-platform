DROP DATABASE IF EXISTS Netflix_OTT;
CREATE DATABASE Netflix_OTT;
USE Netflix_OTT;
CREATE TABLE Users(User_id int PRIMARY KEY AUTO_INCREMENT, Name varchar(100) NOT NULL, Email varchar(100) UNIQUE NOT NULL, Password varchar(255) NOT NULL, Phone varchar(15), Registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE Profiles(Profile_id int PRIMARY KEY AUTO_INCREMENT, User_id int NOT NULL, Profile_name varchar(50) NOT NULL, Is_Kids BOOLEAN DEFAULT False, Age int, FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE);
CREATE TABLE Subscription_Plans(Plan_id int PRIMARY KEY AUTO_INCREMENT, Plan_name varchar(50) NOT NULL, Price decimal(10,2) NOT NULL, Duration_months int NOT NULL,Max_screens int NOT NULL, Video_quality varchar(20) NOT NULL);
CREATE TABLE Subscriptions(Subscription_id int PRIMARY KEY AUTO_INCREMENT, User_id int NOT NULL,Plan_id int NOT NULL, Start_date DATE NOT NULL, End_date DATE NOT NULL, Status VARCHAR(20) DEFAULT 'Active', FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE, FOREIGN KEY (Plan_id) REFERENCES Subscription_Plans(Plan_id) ON DELETE CASCADE);
CREATE TABLE Payments(Payment_id int PRIMARY KEY AUTO_INCREMENT, User_id int NOT NULL, Subscription_id int NOT NULL, Amount decimal(10,2) NOT NULL, Method_of_Payment varchar(50) NOT NULL,Status VARCHAR(20) DEFAULT 'Pending', Payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE, FOREIGN KEY (Subscription_id) REFERENCES Subscriptions(Subscription_id) ON DELETE CASCADE);
CREATE TABLE Content(Content_id int PRIMARY KEY AUTO_INCREMENT, Title varchar(150) NOT NULL, Description TEXT, Release_YEAR YEAR,Duration int, Type VARCHAR(20) NOT NULL,Maturity_rating VARCHAR(10), Language varchar(50));
CREATE TABLE Genres(Genre_id int PRIMARY KEY AUTO_INCREMENT, Genre_name varchar(50)UNIQUE NOT NULL);
CREATE TABLE Directors(Director_id int PRIMARY KEY AUTO_INCREMENT, Director_name varchar(100) NOT NULL);
CREATE TABLE Actors(Actor_id int PRIMARY KEY AUTO_INCREMENT, Actor_name varchar(100) NOT NULL);
CREATE TABLE Content_Genres(Content_id int NOT NULL, Genre_id int NOT NULL, PRIMARY KEY (Content_id, Genre_id), FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE, FOREIGN KEY (Genre_id) REFERENCES Genres(Genre_id) ON DELETE CASCADE);
CREATE TABLE Content_Directors(Content_id int NOT NULL, Director_id int NOT NULL, PRIMARY KEY (Content_id, Director_id), FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE, FOREIGN KEY (Director_id) REFERENCES Directors(Director_id) ON DELETE CASCADE);
CREATE TABLE Content_Actors(Content_id int NOT NULL, Actor_id int NOT NULL, PRIMARY KEY (Content_id, Actor_id), FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE, FOREIGN KEY (Actor_id) REFERENCES Actors(Actor_id) ON DELETE CASCADE);
CREATE TABLE Watch_history(History_id int PRIMARY KEY AUTO_INCREMENT,User_id int NOT NULL, Content_id int NOT NULL, Watch_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, Progress_percentage decimal(5,2) DEFAULT 0.00, Completed BOOLEAN DEFAULT False, FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE, FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE);
CREATE TABLE Rating_Reviews(Review_id int PRIMARY KEY AUTO_INCREMENT, User_id int NOT NULL, Content_id int NOT NULL, Rating decimal(2,1) CHECK (Rating >= 0 AND Rating <= 5), Review_text TEXT, Review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE, FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE);
SET GLOBAL EVENT_SCHEDULER = ON;
CREATE EVENT IF NOT EXISTS Update_Subscription_Status
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    UPDATE Subscriptions
    SET Status = 'Expired'  
    WHERE End_date < CURDATE() AND Status = 'Active';
END;