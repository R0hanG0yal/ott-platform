import os
import re
import hashlib
import secrets
import calendar
from datetime import date
from decimal import Decimal,InvalidOperation
import mysql.connector
from mysql.connector import Error, IntegrityError
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'root'),
    'database': os.getenv('DB_NAME', 'Netflix_OTT') 
    }
try:
    db = mysql.connector.connect(**DB_CONFIG)

    if db.is_connected():
        print("Connected to Netflix OTT database successfully!")

    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT DATABASE() AS db_name")
    print("Database:", cursor.fetchone()['db_name'])

except mysql.connector.Error as e:
    print("Error connecting to database:", e)
    raise SystemExit(1)
PAYMENT_METHODS = ['UPI', 'Card']
MENU_SEPARATOR = '=' * 50
def read_nonempty(prompt):
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("Input cannot be empty. Please try again.")
def read_int(prompt,min_value=None,max_value=None):
    while True:
        raw=input(prompt).strip()
        try:
            value = int(raw)
            if (min_value is not None and value < min_value) or (max_value is not None and value > max_value):
                raise ValueError
            return value
        except ValueError:
            print(f"Invalid input. Please enter an integer", end='')
            if min_value is not None and max_value is not None:
                print(f" between {min_value} and {max_value}.")
            elif min_value is not None:
                print(f" greater than or equal to {min_value}.")
            elif max_value is not None:
                print(f" less than or equal to {max_value}.")
            else:
                print(".")
def read_optional_int(prompt,min_value=None,max_value=None):
    while True:
        raw=input(prompt).strip()
        if raw=='':
            return None
        try:
            value = int(raw)
            if (min_value is not None and value < min_value) or (max_value is not None and value > max_value):
                raise ValueError
            return value
        except ValueError:
            print(f"Invalid input. Please enter an integer", end='')
            if min_value is not None and max_value is not None:
                print(f" between {min_value} and {max_value}.")
            elif min_value is not None:
                print(f" greater than or equal to {min_value}.")
            elif max_value is not None:
                print(f" less than or equal to {max_value}.")
            else:
                print(".")
def valid_email(email):
    return bool(re.fullmatch(r"[^@]+@[^@]+\.[^@]+", email))
def hash_password(password):
    salt = secrets.token_hex(16)
    digest=hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return "pbkdf2_sha256$100000$" + salt + "$" + digest.hex()
def add_months(start_date, months):
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)
def safe_rollback(connection):
    try:
        connection.rollback()
    except Error as e:
        print(f"Error during rollback: {e}")
def get_one(cursor,query,params=None):
    cursor.execute(query,params)
    return cursor.fetchone()
def user_exists(cursor,user_id):
    return get_one(cursor,"SELECT 1 FROM Users WHERE User_id=%s",(user_id,)) is not None
def content_exists(cursor,content_id):
    return get_one(cursor,"SELECT 1 FROM Content WHERE Content_ID=%s",(content_id,)) is not None
def print_rows(rows,empty_message="No records found."):
    if not rows:
        print(empty_message)
        return
    for row in rows:
        print(row)
def connect_database():
   try:
       db=mysql.connector.connect(**DB_CONFIG)
       cursor=db.cursor(dictionary=True)
       print("Connected to Netflix_OTT database successfully.")
       return db,cursor
   except Error as e:
        print(f"Error connecting to database: {e}")
        print("Please ensure that the MySQL server is running and the database 'Netflix_OTT' exists.")
        return None,None
def show_plans(cursor):
    cursor.execute("""SELECT Plan_ID, Plan_Name, Price, Duration_months,
               Video_quality, Max_screens
        FROM Subscription_Plans
        ORDER BY Plan_ID
    """)
    plans = cursor.fetchall()
    print("\n--- SUBSCRIPTION PLANS ---")
    if not plans:
        print("No subscription plans are available.")
        return
    for plan in plans:
        print(
            f"{plan['Plan_ID']}. {plan['Plan_Name']} | "
            f"Rs.{plan['Price']} | {plan['Duration_months']} month(s) | "
            f"{plan['Video_quality']} | {plan['Max_screens']} screen(s)"
        )
def register_user(db,cursor):
    print("\n-----REGISTER USER-----")
    name=read_nonempty("Enter your name: ")
    email=read_nonempty("Enter your email: ")
    if not valid_email(email):
        print("Invalid email format. Please try again.")
        return
    password=read_nonempty("Enter your password: ")
    if len(password)<8:
        print("Password must be at least 8 characters long. Please try again.")
        return
    phone=input("Enter your phone number: ")
    profile_name=read_nonempty("Enter profile name: ")
    kids_input=input("Is this a kids profile? (yes/no): ").strip().lower()
    if kids_input not in ['yes', 'no']:
        print("Invalid input for kids profile. Please enter 'yes' or 'no'.")
        return
    try:
        db.start_transaction()
        cursor.execute("INSERT INTO Users (Name, Email, Password, Phone) VALUES (%s, %s, %s, %s)", (name, email, hash_password(password), phone))
        db.commit()
        print("User registered successfully.")
    except os.error as exc:
        safe_rollback(db)
        if exc.errno == 1062:
            print("Registration failed: this email is already registered. Please log in or use another email.")
        elif exc.errno == 1452:
            print("Registration failed: a referenced record does not exist.")
        else:
            print(f"Registration failed due to a database constraint: {exc}")
    except Error as exc:
        safe_rollback(db)
        print(f"Database error during registration. No changes were saved: {exc}")
    except Exception as exc:
        safe_rollback(db)
        print(f"Unexpected registration error. No changes were saved: {exc}")
def subscribe(db,cursor):
    print("\n----SUBSCRIBE -----")
    user_id=read_int("Enter your User ID: ",min_value=1)
    if not user_exists(cursor,user_id):
        print("User ID does not exist. Please register first.")
        return
    show_plans(cursor)
    plan_id=read_int("Enter the Plan ID you want to subscribe to: ",min_value=1)
    pla=n=get_one(cursor,"SELECT * FROM Subscription_Plans WHERE Plan_ID=%s",(plan_id,))
    if not pla:
        print("Plan ID does not exist. Please select a valid plan.")
        return  
    method=read_nonempty(f"Enter payment method ({'/'.join(PAYMENT_METHODS)}): ").strip()
    if method not in PAYMENT_METHODS:
        print(f"Invalid payment method. Please choose from {', '.join(PAYMENT_METHODS)}.")
        return
    if method.lower()=="failtest":
        method="FailTest"
    else:
        method=method.upper()
        if method not in PAYMENT_METHODS:
            print(f"Invalid payment method. Please choose from {', '.join(PAYMENT_METHODS)}.")
            return
    start_date=date.today()
    end_date=add_months(start_date,pla['Duration_months'])
    amount=pla['Price']
    try:
        db.start_transaction()
        cursor.execute("""INSERT INTO Subscriptions(User_ID, Plan_ID, Start_Date, End_Date, Status)VALUES (%s, %s, %s, %s, 'Active')""",
            (user_id, plan_id, start_date, end_date),
        )
        subscription_id = cursor.lastrowid

        if method == "FailTest":
            raise RuntimeError("Simulated payment failure: transaction declined.")

        cursor.execute("""INSERT INTO Payments(User_ID, Subscription_ID, Amount, Method_of_Payment, Status)VALUES (%s, %s, %s, %s, 'Success')""",
            (user_id, subscription_id, amount, method),
        )
        db.commit()
        print("Subscription activated successfully!")
        print(f"Subscription_ID: {subscription_id}")
        print(f"Plan: {pla['Plan_Name']} | Amount: Rs.{amount}")
        print(f"Valid from {start_date} to {end_date}.")

    except RuntimeError as exc:
        safe_rollback(db)
        print(f"Payment unsuccessful: {exc}")
        print("The subscription was rolled back; no active subscription was created.")
    except os.error as exc:
        safe_rollback(db)
        print(f"Subscription could not be created because of a data constraint: {exc}")
    except Error as exc:
        safe_rollback(db)
        print(f"Database/payment processing error. Transaction rolled back: {exc}")
    except Exception as exc:
        safe_rollback(db)
        print(f"Unexpected error. Transaction rolled back: {exc}")
def browse_content(cursor):
    print("\n---BROWSE CONTENT---")
    print("Leave a filter blank to skip it.")
    type_value=input("Enter content type (Movie/Series): ").strip()
    language=input("Enter language: ").strip()
    genre=input("Enter genre: ").strip()
    year=read_optional_int("Enter release year: ",min_value=1900,max_value=date.today().year)
    maturity=input("Enter maturity rating (G, PG, PG-13, R, NC-17): ").strip()
    if type_value and type_value.lower() not in ['movie', 'series']:
        print("Invalid content type. Please enter 'Movie' or 'Series'.")
        return
    if year and not year.isdigit():
        print("Invalid year. Please enter a valid year.")
        return
    query = """
        SELECT DISTINCT c.Content_ID, c.Title, c.Type, c.Language,
               c.Release_Year, c.Maturity_rating, c.Duration
        FROM Content c
        LEFT JOIN Content_Genres cg ON c.Content_ID = cg.Content_ID
        LEFT JOIN Genres g ON cg.Genre_ID = g.Genre_ID
        WHERE 1=1
    """
    params = []
    if type_value:
        query += " AND c.Type = %s"
        params.append(type_value)
    if language:
        query += " AND c.Language = %s"
        params.append(language)
    if genre:
        query += " AND g.Genre_Name = %s"
        params.append(genre)
    if year:
        query += " AND c.Release_Year = %s"
        params.append(year)
    if maturity:
        query += " AND c.Maturity_rating = %s"
        params.append(maturity)
    query += " ORDER BY c.Title"
    try:
        cursor.execute(query, params)
        results = cursor.fetchall()
        if not results:
            print("No content found matching the specified filters.")
            return
        print("\n--- CONTENT LIST ---")
        for content in results:
            cursor.execute("""SELECT g.Genre_name FROM Content_Genres cg JOIN Genres g ON cg.Genre_ID=g.Genre_ID WHERE cg.Content_ID=%s ORDER BY g.Genre_name""",
                (content["Content_ID"],),
            )
            genres = [row["Genre_name"] for row in cursor.fetchall()]
            print(
                f"ID: {content['Content_ID']} | Title: {content['Title']} | Type: {content['Type']} | "
                f"Language: {content['Language']} | Year: {content['Release_Year']} | "
                f"Maturity: {content['Maturity_rating']} | Duration: {content['Duration']} mins | "
                f"Genres: {', '.join(genres) if genres else 'N/A'}"
            ) 
    except Error as exc:
        print(f"Error retrieving content: {exc}")
def watch_content(db,cursor):
    print("\n------WATCHCONTENT------")
    user_if=read_int("Enter your User ID: ",min_value=1)
    if not user_exists(cursor,user_if):
        print("User ID does not exist. Please register first.")
        return
    contetn_id=read_int("Enter the Content ID you want to watch: ",min_value=1)
    if not content_exists(cursor,contetn_id):
        print("Content ID does not exist. Please browse content first.")
        return
    progess=read_int("Enter your progress percentage (0-100): ",min_value=0,max_value=100)
    completed=progess==100
    try:
        cursor.execute("""INSERT INTO Watch_History(User_ID, Content_ID, Progress, Completed)VALUES (%s, %s, %s, %s)""", (user_if,contetn_id, Decimal(str(progess)), completed),)
        db.commit()
        print("Watch history updated successfully.")
    except InvalidOperation:
        print("Invalid progress value. Please enter a valid decimal number.")
    except Error as exc:
        safe_rollback(db)
        print(f"Error updating watch history: {exc}")
def rate_content(db,cursor):
    print("\n-------RATE CONTENT-------")
    user_id=read_int("Enter your User ID: ",min_value=1)
    if not user_exists(cursor,user_id):
        print("User ID does not exist. Please register first.")
        return
    content_id=read_int("Enter the Content ID you want to rate: ",min_value =1)
    if not content_exists(cursor,content_id):
        print("Content ID does not exist. Please browse content first.")
        return
    rating=read_int("Enter your rating (1-5): ",min_value=1,max_value=5)
    review_text=input("Enter your review (optional): ").strip()
    try:
        cursor.execute("""INSERT INTO Rating_Reviews(User_ID, Content_ID, Rating, Review_Text)VALUES (%s, %s, %s, %s)""", (user_id, content_id, rating, review_text),)
        db.commit()
        print("Rating and review submitted successfully.")
    except IntegrityError as exc:
        safe_rollback(db)
        if exc.errno == 1062:
            print("You have already submitted a rating/review for this content. Please update your existing review instead.")
        else:
            print(f"Integrity error while submitting rating/review: {exc}")
    except Error as exc:
        safe_rollback(db)
        print(f"Error submitting rating/review: {exc}")
def dashboard(db,cursor):
    print("\n-----WELCOME TO NETFLIX DASHBOARD-----")
    user_id=read_int("Enter your User ID to continue: ",min_value=1)
    if not user_exists(cursor,user_id):
        print("User ID does not exist. Please register first.")
        return
    while True:
        print("1. Browse Movies & Series")
        print("2. Subscribe / Upgrade Plan")
        print("3. Ongoing Subscription")
        print("4. Continue Watching")
        print("5. Watch Content")
        print("6. Rate & Review Content")
        print("7. My Ratings")
        print("8. My Profiles")
        print("9. My Payment History")
        print("10. Full Dashboard")
        print("11. Back to Main Menu")
        choice=read_int("Enter your choice (1-6): ",min_value=1,max_value=6)
        try:
            if choice==1:
                browse_content(cursor)
            elif choice==2:
                subscribe(db,cursor)
            elif choice==3:
                cursor.execute("""SELECT s.Subscription_ID, sp.Plan_Name, s.Start_Date, s.End_Date, s.Status
                    FROM Subscriptions s
                    JOIN Subscription_Plans sp ON s.Plan_ID = sp.Plan_ID
                    WHERE s.User_ID = %s
                    ORDER BY s.Start_Date DESC""", (user_id,))
                subscriptions=cursor.fetchall()
                print("\n---ONGOING SUBSCRIPTIONS---")
                print_rows(subscriptions,"No subscriptions found.")
            elif choice==4:
                cursor.execute("""SELECT wh.Content_ID, c.Title, wh.Progress, wh.Completed
                    FROM Watch_History wh
                    JOIN Content c ON wh.Content_ID = c.Content_ID
                    WHERE wh.User_ID = %s AND wh.Completed = FALSE
                    ORDER BY wh.Watch_Date DESC""", (user_id,))
                ongoing=cursor.fetchall()
                print("\n---CONTINUE WATCHING---")
                print_rows(ongoing,"No ongoing content found.")
            elif choice==5:
                watch_content(db,cursor)
            elif choice==6:
                rate_content(db,cursor)
            elif choice==7:
                cursor.execute("""SELECT rr.Content_ID, c.Title, rr.Rating, rr.Review_Text
                    FROM Rating_Reviews rr
                    JOIN Content c ON rr.Content_ID = c.Content_ID
                    WHERE rr.User_ID = %s
                    ORDER BY rr.Rating DESC""", (user_id,))
                ratings=cursor.fetchall()
                print("\n---MY RATINGS & REVIEWS---")
                print_rows(ratings,"No ratings/reviews found.")
            elif choice==8:
                cursor.execute("""SELECT Profile_ID, Profile_Name, Is_Kids, Age
                    FROM Profiles
                    WHERE User_ID = %s""", (user_id,))
                profiles=cursor.fetchall()
                print("\n---MY PROFILES---")
                print_rows(profiles,"No profiles found.")
            elif choice==9:
                cursor.execute("""SELECT Payment_ID, Subscription_ID, Amount, Method_of_Payment, Status, Payment_date
                    FROM Payments
                    WHERE User_ID = %s
                    ORDER BY Payment_date DESC""", (user_id,))
                payments=cursor.fetchall()
                print("\n---MY PAYMENT HISTORY---")
                print_rows(payments,"No payment history found.")
            elif choice==10:
                cursor.execute("""SELECT s.Subscription_ID, sp.Plan_Name, s.Start_Date, s.End_Date, s.Status
                    FROM Subscriptions s
                    JOIN Subscription_Plans sp ON s.Plan_ID = sp.Plan_ID
                    WHERE s.User_ID = %s
                    ORDER BY s.Start_Date DESC""", (user_id,))
                subscriptions=cursor.fetchall()
                print("\n---ONGOING SUBSCRIPTIONS---")
                print_rows(subscriptions,"No subscriptions found.")
                cursor.execute("""SELECT wh.Content_ID, c.Title, wh.Progress, wh.Completed
                    FROM Watch_History wh
                    JOIN Content c ON wh.Content_ID = c.Content_ID
                    WHERE wh.User_ID = %s AND wh.Completed = FALSE
                    ORDER BY wh.Watch_Date DESC""", (user_id,))
                ongoing=cursor.fetchall()
                print("\n---CONTINUE WATCHING---")
                print_rows(ongoing,"No ongoing content found.")
                cursor.execute("""SELECT rr.Content_ID, c.Title, rr.Rating, rr.Review_Text
                    FROM Rating_Reviews rr
                    JOIN Content c ON rr.Content_ID = c.Content_ID
                    WHERE rr.User_ID = %s
                    ORDER BY rr.Rating DESC""", (user_id,))
                ratings=cursor.fetchall()
                print("\n---MY RATINGS & REVIEWS---")
                print_rows(ratings,"No ratings/reviews found.")
                cursor.execute("""SELECT Profile_ID, Profile_Name, Is_Kids, Age
                    FROM Profiles
                    WHERE User_ID = %s""", (user_id,))
                profiles=cursor.fetchall()
                print("\n---MY PROFILES---")
                print_rows(profiles,"No profiles found.")
                cursor.execute("""SELECT Payment_ID, Subscription_ID, Amount, Method_of_Payment, Status, Payment_date
                    FROM Payments
                    WHERE User_ID = %s
                    ORDER BY Payment_date DESC""", (user_id,))
                payments=cursor.fetchall()
                print("\n---MY PAYMENT HISTORY---")
                print_rows(payments,"No payment history found.")
            elif choice==11:
                print("Returning to main menu.")
                break
            else:
                print("Invalid choice. Please select a valid option.")
        except Error as exc:
            print(f"Database error occurred: {exc}")
def run_scheduler(db,cursor):
    print("\n---SCHEDULER: Update Subscription Statuses---")
    try:
        cursor.execute("""UPDATE Subscriptions
            SET Status = 'Expired'
            WHERE End_Date < CURDATE() AND Status != 'Expired'""")
        db.commit()
        print(f"Scheduler completed. {cursor.rowcount} subscription(s) updated to 'Expired'.")
    except Error as exc:
        safe_rollback(db)
        print(f"Error during scheduler execution: {exc}")
def filter_any_table(cursor):
    print("\n---FILTER ANY TABLE---")
    print("1.Content")
    print("2.User")
    print("3.Profiles")
    print("4.Subscription_Plans")
    print("5.Subscriptions")
    print("6.Payments")
    print("7.watch_history")
    choice=read_int("Select a table to filter (1-7): ",min_value=1,max_value=7)
    params=[]
    if choice==1:
        type=input("Enter content type (Movie/Series) or leave blank: ").strip()
        language=input("Enter language or leave blank: ").strip()
        genre=input("Enter genre or leave blank: ").strip()
        year=read_optional_int("Enter release year or leave blank: ",min_value=1900,max_value=date.today().year)
        maturity=input("Enter maturity rating (G, PG, PG-13, R, NC-17) or leave blank: ").strip()
        query="""select c.Content_ID, c.Title, c.Type, c.Language, c.Release_Year, c.Maturity_rating, c.Duration from Content c left join Content_Genres cg on c.Content_ID=cg.Content_ID left join Genres g on cg.Genre_ID=g.Genre_ID where 1=1"""
        if type:
            query+=" and c.Type=%s"
            params.append(type)
        if language:
            query+=" and c.Language=%s"
            params.append(language)
        if genre:
            query+=" and g.Genre_Name=%s"
            params.append(genre)
        if year:
            query+=" and c.Release_Year=%s"
            params.append(year) 
        if maturity:
            query+=" and c.Maturity_rating=%s"
            params.append(maturity)
    elif choice==4:
        plan_name=input("Enter plan name filter or leave blank: ").strip()
        price=read_optional_int("Enter price filter or leave blank: ",min_value=0)
        duration=read_optional_int("Enter duration in months filter or leave blank: ",min_value=1)
        max_screens=read_optional_int("Enter max screens filter or leave blank: ",min_value=1)
        video_quality=input("Enter video quality filter or leave blank: ").strip()
        query="""select Plan_ID, Plan_Name, Price, Duration_months, Max_screens, Video_quality from Subscription_Plans where 1=1"""
        if plan_name:
            query+=" and Plan_Name=%s"
            params.append(plan_name)
        if price is not None:
            query+=" and Price=%s"
            params.append(price)
        if duration is not None:
            query+=" and Duration_months=%s"
            params.append(duration)
        if max_screens is not None:
            query+=" and Max_screens=%s"
            params.append(max_screens)
        if video_quality:
            query+=" and Video_quality=%s"
            params.append(video_quality)
    elif choice==2:
        name=input("Enter name filter or leave blank: ").strip()
        email=input("Enter email filter or leave blank: ").strip()
        phone=input("Enter phone filter or leave blank: ").strip()
        query="""select User_ID, Name, Email, Phone from Users where 1=1"""
        if name:
            query+=" and Name=%s"
            params.append(name)
        if email:
            query+=" and Email=%s"
            params.append(email)
        if phone:
            query+=" and Phone=%s"
            params.append(phone)
    elif choice==3:
        profile_name=input("Enter profile name filter or leave blank: ").strip()
        is_kids_input=input("Filter by kids profile? (yes/no) or leave blank: ").strip().lower()
        age=read_optional_int("Enter age filter or leave blank: ",min_value=0)
        query="""select Profile_ID, User_ID, Profile_Name, Is_Kids, Age from Profiles where 1=1"""
        if profile_name:
            query+=" and Profile_Name=%s"
            params.append(profile_name)
        if is_kids_input:
            if is_kids_input not in ['yes', 'no']:
                print("Invalid input for kids profile. Please enter 'yes' or 'no'.")
                return
            is_kids_value = True if is_kids_input == 'yes' else False
            query+=" and Is_Kids=%s"
            params.append(is_kids_value)
        if age is not None:
            query+=" and Age=%s"
            params.append(age)
    elif choice==5:
        user_id=read_optional_int("Enter User ID filter or leave blank: ",min_value=1)
        plan_id=read_optional_int("Enter Plan ID filter or leave blank: ",min_value=1)
        status=input("Enter subscription status filter (Active/Expired) or leave blank: ").strip()
        query="""select s.Subscription_ID, s.User_ID, s.Plan_ID, s.Start_Date, s.End_Date, s.Status from Subscriptions s where 1=1"""
        if user_id is not None:
            query+=" and s.User_ID=%s"
            params.append(user_id)
        if plan_id is not None:
            query+=" and s.Plan_ID=%s"
            params.append(plan_id)
        if status:
            if status.lower() not in ['active', 'expired']:
                print("Invalid subscription status. Please enter 'Active' or 'Expired'.")
                return
            query+=" and s.Status=%s"
            params.append(status)
    elif choice==6:
        user_id=read_optional_int("Enter User ID filter or leave blank: ",min_value=1)
        status=input("Enter payment status filter (Pending/Success/Failed) or leave blank: ").strip()
        query="""select p.Payment_ID, p.User_ID, p.Subscription_ID, p.Amount, p.Method_of_Payment, p.Status, p.Payment_date from Payments p where 1=1"""
        if user_id is not None:
            query+=" and p.User_ID=%s"
            params.append(user_id)
        if status:
            if status.lower() not in ['pending', 'success', 'failed']:
                print("Invalid payment status. Please enter 'Pending', 'Success', or 'Failed'.")
                return
            query+=" and p.Status=%s"
            params.append(status)
    elif choice==7:
        user_id=read_optional_int("Enter User ID filter or leave blank: ",min_value=1)
        completed_input=input("Filter by completion status? (yes/no) or leave blank: ").strip().lower()
        query="""select wh.Watch_ID, wh.User_ID, wh.Content_ID, wh.Progress, wh.Completed, wh.Watch_Date from Watch_History wh where 1=1"""
        if user_id is not None:
            query+=" and wh.User_ID=%s"
            params.append(user_id)
        if completed_input:
            if completed_input not in ['yes', 'no']:
                print("Invalid input for completion status. Please enter 'yes' or 'no'.")
                return
            completed_value = True if completed_input == 'yes' else False
            query+=" and wh.Completed=%s"
            params.append(completed_value)
    query+=" order by 1"
    try:
        cursor.execute(query,params)
        results=cursor.fetchall()
        print("\n---FILTERED RESULTS---")
        print_rows(results,"No records found matching the specified filters.")
    except Error as exc:
        print(f"Error retrieving filtered results: {exc}")
def show_all_users(cursor):
    cursor.execute("SELECT User_ID, Name, Email, Phone, Registration_date FROM Users ORDER BY User_ID")
    users=cursor.fetchall()
    print("\n---ALL USERS---")
    print_rows(users,"No users found.")
def main():
    db,cursor=connect_database()
    if not db.cursor:
        print("Exiting application due to database connection failure.")
        return
    actions={
        "1":lambda: register_user(db,cursor),
        "2":lambda: subscribe(db,cursor),
        "3":lambda: browse_content(cursor),
        "4":lambda: watch_content(db,cursor),
        "5":lambda: rate_content(db,cursor),
        "6":lambda: dashboard(db,cursor),
        "7":lambda: run_scheduler(db,cursor),
        "8":lambda: filter_any_table(cursor),
        "9":lambda: show_all_users(cursor),
        "10":lambda: exit()
    }
    try:
        while True:
            print(MENU_SEPARATOR)
            print("Welcome to the Netflix OTT Application")
            print("1. Register User")
            print("2. Subscribe / Upgrade Plan")
            print("3. Browse Movies & Series")
            print("4. Watch Content")
            print("5. Rate & Review Content")
            print("6. User Dashboard")
            print("7. Run Scheduler (Update Subscription Statuses)")
            print("8. Filter Any Table")
            print("9. Show All Users")
            print("10. Exit")
            choice=read_int("Enter your choice (1-10): ",min_value=1,max_value=10)
            if choice in actions:
                actions[choice]()
            else:
                print("Invalid choice. Please select a valid option.")
    except KeyboardInterrupt:
        print("\nExiting application. Goodbye!")
    finally:
        if cursor:
            cursor.close()
        if db:
            db.close()
        print("Database connection closed.")
if __name__=="__main__":
    main()