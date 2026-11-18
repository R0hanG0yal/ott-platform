USE Netflix_OTT;
INSERT INTO Users (Name, Email, Password, Phone)VALUES
('Aarav Sharma','aarav@gmail.com','pass123','9876543210'),
('Priya Singh','priya@gmail.com','pass123','9876543211'),
('Rohan Verma','rohan@gmail.com','pass123','9876543212');
INSERT INTO Profiles
(User_ID, Profile_Name, Is_Kids)
VALUES
(1,'Aarav',FALSE),
(1,'Kids',TRUE),
(2,'Priya',FALSE),
(3,'Rohan',FALSE);
INSERT INTO Subscription_Plans(Plan_id, Plan_name, Price, Duration_months, Max_screens, Video_quality)VALUES
(1,'Basic',199,1,1,'480p'),
(2,'Standard',499,1,2,'1080p'),
(3,'Premium',649,1,4,'4K');
INSERT INTO Subscriptions(User_ID, Plan_ID, Start_Date, End_Date, Status)VALUES
(1,3,'2026-11-01','2026-12-01','Active'),
(2,2,'2026-11-01','2026-12-01','Active'),
(3,1,'2026-10-01','2026-11-01','Expired');
INSERT INTO Payments(User_ID, Subscription_ID, Amount, Method_of_Payment, Status)VALUES
(1,1,649,'UPI','Success'),
(2,2,499,'Card','Success'),
(3,3,199,'UPI','Success');
INSERT INTO Content(Title, Description, Release_Year, Duration, Type, Maturity_Rating, Language)VALUES
('Money Heist','Heist drama',2017,60,'Series','U/A','Hindi'),
('3 Idiots','College comedy',2009,170,'Movie','U','Hindi'),
('Stranger Things','Sci-fi',2016,50,'Series','U/A','English'),
('Jawan','Action',2023,169,'Movie','U/A','Hindi'),
('Kota Factory','Student life',2019,45,'Series','U','Hindi');
INSERT INTO Genres (Genre_Name)VALUES
('Action'),
('Comedy'),
('Drama'),
('Thriller'),
('Sci-Fi');
INSERT INTO Directors (Director_Name)VALUES
('Rajkumar Hirani'),
('Atlee'),
('Duffer Brothers');
INSERT INTO Actors (Actor_Name)VALUES
('Shah Rukh Khan'),
('Aamir Khan'),
('Millie Bobby Brown');
INSERT INTO Content_Genres (Content_ID, Genre_ID)VALUES
(1,4),(2,2),(2,3),(3,5),(4,1),(5,3);
INSERT INTO Content_Directors (Content_ID, Director_ID)VALUES
(2,1),(4,2),(3,3);
INSERT INTO Content_Actors (Content_ID, Actor_ID)VALUES
(4,1),(2,2),(3,3);
INSERT INTO Watch_History(User_ID, Content_ID, Progress_percentage, Completed)VALUES
(1,1,100,TRUE),
(1,4,50,FALSE),
(2,2,100,TRUE),
(2,3,100,TRUE),
(3,5,100,TRUE),
(3,2,80,FALSE);
INSERT INTO Rating_Reviews(User_ID, Content_ID, Rating, Review_Text)VALUES
(1,1,5,'Amazing'),
(2,2,5,'Best movie'),
(2,3,4,'Very good'),
(3,5,5,'Relatable');


