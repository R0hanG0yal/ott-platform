import calendar
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
LOCAL_SQLITE_PATH = BASE_DIR / "netflix_local_mirror.db"

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "root"),
    "database": os.getenv("DB_NAME", "Netflix_OTT"),
    "port": int(os.getenv("DB_PORT", "3306")),
}

PAYMENT_METHODS = ["UPI", "Card"]
KIDS_SAFE_RATINGS = {"U", "G", "PG", "TV-Y", "TV-Y7", "TV-G"}


def valid_email(email: str) -> bool:
    return bool(re.fullmatch(r"[^@]+@[^@]+\.[^@]+", email.strip()))


def hash_password(password: str) -> str:
    """Matches main.py hash_password format exactly."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"pbkdf2_sha256$100000${salt}${digest.hex()}"


def verify_password(plain_password: str, stored_password: str) -> bool:
    """Supports both main.py pbkdf2_sha256 hashes and data.sql plaintext passwords."""
    if not stored_password:
        return False
    if stored_password.startswith("pbkdf2_sha256$"):
        parts = stored_password.split("$")
        if len(parts) == 4:
            _, iter_str, salt, expected_hex = parts
            try:
                iterations = int(iter_str)
                computed = hashlib.pbkdf2_hmac(
                    "sha256", plain_password.encode(), salt.encode(), iterations
                ).hex()
                return hmac.compare_digest(computed, expected_hex)
            except ValueError:
                return False
    return hmac.compare_digest(plain_password, stored_password)


def add_months(start_date: date, months: int) -> date:
    """Matches main.py add_months exactly."""
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def serialize_value(val: Any) -> Any:
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return val


def serialize_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return {k: serialize_value(v) for k, v in row.items()}


def normalize_keys(row: Optional[Dict[str, Any]], canonical_map: Dict[str, str]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    out: Dict[str, Any] = {}
    for k, v in row.items():
        canon = canonical_map.get(k.lower(), k)
        out[canon] = serialize_value(v)
    return out


CANONICAL_COLUMNS = {
    "user_id": "User_id",
    "name": "Name",
    "email": "Email",
    "password": "Password",
    "phone": "Phone",
    "registration_date": "Registration_date",
    "profile_id": "Profile_id",
    "profile_name": "Profile_name",
    "is_kids": "Is_Kids",
    "age": "Age",
    "plan_id": "Plan_id",
    "plan_name": "Plan_name",
    "price": "Price",
    "duration_months": "Duration_months",
    "max_screens": "Max_screens",
    "video_quality": "Video_quality",
    "subscription_id": "Subscription_id",
    "start_date": "Start_date",
    "end_date": "End_date",
    "status": "Status",
    "payment_id": "Payment_id",
    "amount": "Amount",
    "method_of_payment": "Method_of_Payment",
    "payment_date": "Payment_date",
    "content_id": "Content_id",
    "title": "Title",
    "description": "Description",
    "release_year": "Release_YEAR",
    "duration": "Duration",
    "type": "Type",
    "maturity_rating": "Maturity_rating",
    "language": "Language",
    "genre_id": "Genre_id",
    "genre_name": "Genre_name",
    "director_id": "Director_id",
    "director_name": "Director_name",
    "actor_id": "Actor_id",
    "actor_name": "Actor_name",
    "history_id": "History_id",
    "watch_date": "Watch_date",
    "progress_percentage": "Progress_percentage",
    "completed": "Completed",
    "review_id": "Review_id",
    "rating": "Rating",
    "review_text": "Review_text",
    "review_date": "Review_date",
    "reviewer_name": "Reviewer_name",
}


SQLITE_SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
    User_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Phone VARCHAR(15),
    Registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Profiles (
    Profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_id INTEGER NOT NULL,
    Profile_name VARCHAR(50) NOT NULL,
    Is_Kids BOOLEAN DEFAULT 0,
    Age INTEGER,
    FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Subscription_Plans (
    Plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Plan_name VARCHAR(50) NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    Duration_months INTEGER NOT NULL,
    Max_screens INTEGER NOT NULL,
    Video_quality VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS Subscriptions (
    Subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_id INTEGER NOT NULL,
    Plan_id INTEGER NOT NULL,
    Start_date DATE NOT NULL,
    End_date DATE NOT NULL,
    Status VARCHAR(20) DEFAULT 'Active',
    FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE,
    FOREIGN KEY (Plan_id) REFERENCES Subscription_Plans(Plan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Payments (
    Payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_id INTEGER NOT NULL,
    Subscription_id INTEGER NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    Method_of_Payment VARCHAR(50) NOT NULL,
    Status VARCHAR(20) DEFAULT 'Pending',
    Payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE,
    FOREIGN KEY (Subscription_id) REFERENCES Subscriptions(Subscription_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Content (
    Content_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title VARCHAR(150) NOT NULL,
    Description TEXT,
    Release_YEAR INTEGER,
    Duration INTEGER,
    Type VARCHAR(20) NOT NULL,
    Maturity_rating VARCHAR(10),
    Language VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Genres (
    Genre_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Genre_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS Directors (
    Director_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Director_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Actors (
    Actor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    Actor_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Content_Genres (
    Content_id INTEGER NOT NULL,
    Genre_id INTEGER NOT NULL,
    PRIMARY KEY (Content_id, Genre_id),
    FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE,
    FOREIGN KEY (Genre_id) REFERENCES Genres(Genre_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Content_Directors (
    Content_id INTEGER NOT NULL,
    Director_id INTEGER NOT NULL,
    PRIMARY KEY (Content_id, Director_id),
    FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE,
    FOREIGN KEY (Director_id) REFERENCES Directors(Director_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Content_Actors (
    Content_id INTEGER NOT NULL,
    Actor_id INTEGER NOT NULL,
    PRIMARY KEY (Content_id, Actor_id),
    FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE,
    FOREIGN KEY (Actor_id) REFERENCES Actors(Actor_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Watch_history (
    History_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_id INTEGER NOT NULL,
    Content_id INTEGER NOT NULL,
    Watch_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    Completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE,
    FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Rating_Reviews (
    Review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    User_id INTEGER NOT NULL,
    Content_id INTEGER NOT NULL,
    Rating DECIMAL(2,1) CHECK (Rating >= 0 AND Rating <= 5),
    Review_text TEXT,
    Review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_id) REFERENCES Users(User_id) ON DELETE CASCADE,
    FOREIGN KEY (Content_id) REFERENCES Content(Content_id) ON DELETE CASCADE
);
"""


def seed_sqlite_from_data_sql(conn: sqlite3.Connection) -> None:
    """Seeds the local SQLite mirror directly from ../data.sql (read-only)."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM Users")
    if cur.fetchone()[0] > 0:
        return

    data_sql_path = PROJECT_ROOT / "data.sql"
    if data_sql_path.exists():
        raw_sql = data_sql_path.read_text(encoding="utf-8")
        # Strip MySQL-only `USE Netflix_OTT;` line without touching the source file.
        cleaned_lines = [
            line for line in raw_sql.splitlines() if not line.strip().upper().startswith("USE ")
        ]
        cleaned_sql = "\n".join(cleaned_lines)
        conn.executescript(cleaned_sql)
        conn.commit()
        return

    # Fallback seed matching data.sql verbatim if data.sql was moved
    conn.executescript(
        """
        INSERT INTO Users (Name, Email, Password, Phone) VALUES
        ('Aarav Sharma','aarav@gmail.com','pass123','9876543210'),
        ('Priya Singh','priya@gmail.com','pass123','9876543211'),
        ('Rohan Verma','rohan@gmail.com','pass123','9876543212');
        INSERT INTO Profiles (User_id, Profile_name, Is_Kids) VALUES
        (1,'Aarav',0),(1,'Kids',1),(2,'Priya',0),(3,'Rohan',0);
        INSERT INTO Subscription_Plans (Plan_id, Plan_name, Price, Duration_months, Max_screens, Video_quality) VALUES
        (1,'Basic',199,1,1,'480p'),(2,'Standard',499,1,2,'1080p'),(3,'Premium',649,1,4,'4K');
        INSERT INTO Subscriptions (User_id, Plan_id, Start_date, End_date, Status) VALUES
        (1,3,'2026-11-01','2026-12-01','Active'),
        (2,2,'2026-11-01','2026-12-01','Active'),
        (3,1,'2026-10-01','2026-11-01','Expired');
        INSERT INTO Payments (User_id, Subscription_id, Amount, Method_of_Payment, Status) VALUES
        (1,1,649,'UPI','Success'),(2,2,499,'Card','Success'),(3,3,199,'UPI','Success');
        INSERT INTO Content (Title, Description, Release_YEAR, Duration, Type, Maturity_rating, Language) VALUES
        ('Money Heist','Heist drama',2017,60,'Series','U/A','Hindi'),
        ('3 Idiots','College comedy',2009,170,'Movie','U','Hindi'),
        ('Stranger Things','Sci-fi',2016,50,'Series','U/A','English'),
        ('Jawan','Action',2023,169,'Movie','U/A','Hindi'),
        ('Kota Factory','Student life',2019,45,'Series','U','Hindi');
        INSERT INTO Genres (Genre_name) VALUES ('Action'),('Comedy'),('Drama'),('Thriller'),('Sci-Fi');
        INSERT INTO Directors (Director_name) VALUES ('Rajkumar Hirani'),('Atlee'),('Duffer Brothers');
        INSERT INTO Actors (Actor_name) VALUES ('Shah Rukh Khan'),('Aamir Khan'),('Millie Bobby Brown');
        INSERT INTO Content_Genres (Content_id, Genre_id) VALUES (1,4),(2,2),(2,3),(3,5),(4,1),(5,3);
        INSERT INTO Content_Directors (Content_id, Director_id) VALUES (2,1),(4,2),(3,3);
        INSERT INTO Content_Actors (Content_id, Actor_id) VALUES (4,1),(2,2),(3,3);
        INSERT INTO Watch_history (User_id, Content_id, Progress_percentage, Completed) VALUES
        (1,1,100,1),(1,4,50,0),(2,2,100,1),(2,3,100,1),(3,5,100,1),(3,2,80,0);
        INSERT INTO Rating_Reviews (User_id, Content_id, Rating, Review_text) VALUES
        (1,1,5,'Amazing'),(2,2,5,'Best movie'),(2,3,4,'Very good'),(3,5,5,'Relatable');
        """
    )
    conn.commit()


class DatabaseBridge:
    """
    Connects live to MySQL Netflix_OTT (same DB_CONFIG as main.py).
    Automatically falls back to a local SQLite mirror of schema.sql + data.sql
    if mysql-connector/pymysql or MySQL server is not running.
    """

    def __init__(self) -> None:
        self.mode: str = "sqlite_mirror"
        self.driver: Optional[str] = None
        self.mysql_error: Optional[str] = None
        self._detect_backend()

    def _detect_backend(self) -> None:
        # Try mysql.connector first (exact driver used by main.py)
        try:
            import mysql.connector  # type: ignore

            conn = mysql.connector.connect(**DB_CONFIG)
            if conn.is_connected():
                conn.close()
                self.mode = "mysql"
                self.driver = "mysql.connector"
                self.mysql_error = None
                return
        except ImportError:
            self.mysql_error = "mysql-connector-python not installed; using local SQLite mirror of schema.sql + data.sql."
        except Exception as exc:
            self.mysql_error = f"MySQL unreachable ({exc}); using local SQLite mirror of schema.sql + data.sql."

        # Try pymysql as secondary driver
        try:
            import pymysql  # type: ignore

            conn = pymysql.connect(
                host=DB_CONFIG["host"],
                user=DB_CONFIG["user"],
                password=DB_CONFIG["password"],
                database=DB_CONFIG["database"],
                port=DB_CONFIG["port"],
            )
            conn.close()
            self.mode = "mysql"
            self.driver = "pymysql"
            self.mysql_error = None
            return
        except Exception:
            pass

        # Initialize SQLite mirror from schema.sql + data.sql
        self.mode = "sqlite_mirror"
        conn = sqlite3.connect(LOCAL_SQLITE_PATH)
        conn.executescript(SQLITE_SCHEMA_SQL)
        seed_sqlite_from_data_sql(conn)
        conn.close()

    def get_connection(self):
        if self.mode == "mysql":
            if self.driver == "mysql.connector":
                import mysql.connector  # type: ignore

                return mysql.connector.connect(**DB_CONFIG)
            if self.driver == "pymysql":
                import pymysql  # type: ignore

                return pymysql.connect(
                    host=DB_CONFIG["host"],
                    user=DB_CONFIG["user"],
                    password=DB_CONFIG["password"],
                    database=DB_CONFIG["database"],
                    port=DB_CONFIG["port"],
                    cursorclass=pymysql.cursors.DictCursor,
                )
        conn = sqlite3.connect(LOCAL_SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _prepare_sql(self, sql: str) -> str:
        if self.mode == "mysql":
            return sql
        # Convert MySQL %s placeholders and CURDATE() to SQLite equivalents
        converted = sql.replace("%s", "?")
        converted = re.sub(r"\bCURDATE\(\)", "date('now')", converted, flags=re.IGNORECASE)
        return converted

    def query_all(self, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        try:
            if self.mode == "mysql" and self.driver == "mysql.connector":
                cur = conn.cursor(dictionary=True)
            else:
                cur = conn.cursor()
            cur.execute(self._prepare_sql(sql), params)
            rows = cur.fetchall()
            result = [normalize_keys(dict(r), CANONICAL_COLUMNS) for r in rows]
            cur.close()
            return [r for r in result if r is not None]
        finally:
            conn.close()

    def query_one(self, sql: str, params: Tuple[Any, ...] = ()) -> Optional[Dict[str, Any]]:
        rows = self.query_all(sql, params)
        return rows[0] if rows else None

    def execute(self, sql: str, params: Tuple[Any, ...] = ()) -> Tuple[int, int]:
        """Returns (lastrowid, rowcount)."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(self._prepare_sql(sql), params)
            conn.commit()
            last_id = cur.lastrowid or 0
            row_count = cur.rowcount if cur.rowcount is not None else 0
            cur.close()
            return int(last_id), int(row_count)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def reset_local_mirror(self) -> None:
        if self.mode != "sqlite_mirror":
            raise HTTPException(status_code=400, detail="Reset is only available in local SQLite mirror mode.")
        if LOCAL_SQLITE_PATH.exists():
            LOCAL_SQLITE_PATH.unlink()
        conn = sqlite3.connect(LOCAL_SQLITE_PATH)
        conn.executescript(SQLITE_SCHEMA_SQL)
        seed_sqlite_from_data_sql(conn)
        conn.close()


db = DatabaseBridge()

app = FastAPI(title="Netflix OTT Frontend Bridge", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- Pydantic Request Models --------------------
class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: str = ""
    profile_name: str
    is_kids: bool = False
    age: Optional[int] = Field(default=None, ge=0, le=120)


class CreateProfileRequest(BaseModel):
    profile_name: str
    is_kids: bool = False
    age: Optional[int] = Field(default=None, ge=0, le=120)


class WatchProgressRequest(BaseModel):
    user_id: int = Field(ge=1)
    content_id: int = Field(ge=1)
    progress_percentage: float = Field(ge=0, le=100)


class ReviewRequest(BaseModel):
    user_id: int = Field(ge=1)
    content_id: int = Field(ge=1)
    rating: float = Field(ge=0, le=5)
    review_text: str = ""


class SubscribeRequest(BaseModel):
    user_id: int = Field(ge=1)
    plan_id: int = Field(ge=1)
    method: str  # UPI, Card, or FailTest


# -------------------- Helper Queries --------------------
def get_user_or_404(user_id: int) -> Dict[str, Any]:
    user = db.query_one(
        "SELECT User_id, Name, Email, Phone, Registration_date FROM Users WHERE User_id = %s",
        (user_id,),
    )
    if not user:
        raise HTTPException(status_code=404, detail="User ID does not exist. Please register first.")
    return user


def get_content_or_404(content_id: int) -> Dict[str, Any]:
    item = db.query_one("SELECT * FROM Content WHERE Content_id = %s", (content_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Content ID does not exist.")
    return item


def enrich_content_list(items: List[Dict[str, Any]], user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    if not items:
        return []

    content_ids = [item["Content_id"] for item in items]

    # Fetch genres, directors, actors, and aggregate ratings in batch
    genre_rows = db.query_all(
        """
        SELECT cg.Content_id, g.Genre_name
        FROM Content_Genres cg
        JOIN Genres g ON cg.Genre_id = g.Genre_id
        ORDER BY g.Genre_name
        """
    )
    director_rows = db.query_all(
        """
        SELECT cd.Content_id, d.Director_name
        FROM Content_Directors cd
        JOIN Directors d ON cd.Director_id = d.Director_id
        ORDER BY d.Director_name
        """
    )
    actor_rows = db.query_all(
        """
        SELECT ca.Content_id, a.Actor_name
        FROM Content_Actors ca
        JOIN Actors a ON ca.Actor_id = a.Actor_id
        ORDER BY a.Actor_name
        """
    )
    rating_rows = db.query_all(
        """
        SELECT Content_id, AVG(Rating) AS avg_rating, COUNT(*) AS review_count
        FROM Rating_Reviews
        GROUP BY Content_id
        """
    )

    genres_by_cid: Dict[int, List[str]] = {}
    for r in genre_rows:
        genres_by_cid.setdefault(r["Content_id"], []).append(r["Genre_name"])

    directors_by_cid: Dict[int, List[str]] = {}
    for r in director_rows:
        directors_by_cid.setdefault(r["Content_id"], []).append(r["Director_name"])

    actors_by_cid: Dict[int, List[str]] = {}
    for r in actor_rows:
        actors_by_cid.setdefault(r["Content_id"], []).append(r["Actor_name"])

    ratings_by_cid: Dict[int, Tuple[Optional[float], int]] = {}
    for r in rating_rows:
        avg_val = r.get("avg_rating")
        ratings_by_cid[r["Content_id"]] = (
            round(float(avg_val), 1) if avg_val is not None else None,
            int(r.get("review_count") or 0),
        )

    watch_by_cid: Dict[int, Dict[str, Any]] = {}
    user_review_by_cid: Dict[int, Dict[str, Any]] = {}
    if user_id is not None:
        w_rows = db.query_all(
            """
            SELECT History_id, Content_id, Progress_percentage, Completed, Watch_date
            FROM Watch_history
            WHERE User_id = %s
            ORDER BY Watch_date DESC, History_id DESC
            """,
            (user_id,),
        )
        for w in w_rows:
            cid = w["Content_id"]
            if cid not in watch_by_cid:
                watch_by_cid[cid] = w

        ur_rows = db.query_all(
            """
            SELECT Review_id, Content_id, Rating, Review_text, Review_date
            FROM Rating_Reviews
            WHERE User_id = %s
            ORDER BY Review_date DESC, Review_id DESC
            """,
            (user_id,),
        )
        for ur in ur_rows:
            cid = ur["Content_id"]
            if cid not in user_review_by_cid:
                user_review_by_cid[cid] = ur

    enriched = []
    for item in items:
        cid = item["Content_id"]
        if cid not in content_ids:
            continue
        avg_rating, review_count = ratings_by_cid.get(cid, (None, 0))
        watch = watch_by_cid.get(cid)
        u_rev = user_review_by_cid.get(cid)
        enriched.append(
            {
                **item,
                "genres": genres_by_cid.get(cid, []),
                "directors": directors_by_cid.get(cid, []),
                "actors": actors_by_cid.get(cid, []),
                "avg_rating": avg_rating,
                "review_count": review_count,
                "user_progress": float(watch["Progress_percentage"]) if watch else 0.0,
                "user_completed": bool(watch["Completed"]) if watch else False,
                "user_watch_date": watch["Watch_date"] if watch else None,
                "user_rating": float(u_rev["Rating"]) if u_rev else None,
                "user_review_text": u_rev["Review_text"] if u_rev else None,
            }
        )
    return enriched


def get_active_subscription(user_id: int) -> Optional[Dict[str, Any]]:
    rows = db.query_all(
        """
        SELECT s.Subscription_id, s.User_id, s.Plan_id, s.Start_date, s.End_date, s.Status,
               sp.Plan_name, sp.Price, sp.Duration_months, sp.Max_screens, sp.Video_quality
        FROM Subscriptions s
        JOIN Subscription_Plans sp ON s.Plan_id = sp.Plan_id
        WHERE s.User_id = %s
        ORDER BY CASE WHEN s.Status = 'Active' THEN 0 ELSE 1 END, s.End_date DESC, s.Subscription_id DESC
        """,
        (user_id,),
    )
    if not rows:
        return None
    for r in rows:
        if str(r.get("Status", "")).lower() == "active":
            return r
    return rows[0]


# -------------------- API Routes --------------------
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "db_mode": db.mode,
        "db_driver": db.driver or "sqlite3",
        "db_name": DB_CONFIG["database"],
        "mysql_error": db.mysql_error,
    }


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    email = payload.email.strip()
    user = db.query_one("SELECT * FROM Users WHERE LOWER(Email) = LOWER(%s)", (email,))
    if not user or not verify_password(payload.password, str(user.get("Password", ""))):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    safe_user = {k: v for k, v in user.items() if k != "Password"}
    profiles = db.query_all(
        "SELECT Profile_id, User_id, Profile_name, Is_Kids, Age FROM Profiles WHERE User_id = %s ORDER BY Profile_id",
        (safe_user["User_id"],),
    )
    for p in profiles:
        p["Is_Kids"] = bool(p.get("Is_Kids"))
    subscription = get_active_subscription(safe_user["User_id"])
    return {
        "user": safe_user,
        "profiles": profiles,
        "subscription": subscription,
    }


@app.post("/api/auth/register")
def register(payload: RegisterRequest):
    name = payload.name.strip()
    email = payload.email.strip()
    password = payload.password
    phone = payload.phone.strip()
    profile_name = payload.profile_name.strip()

    if not name or not email or not profile_name:
        raise HTTPException(status_code=400, detail="Name, email, and profile name are required.")
    if not valid_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format. Please try again.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    existing = db.query_one("SELECT User_id FROM Users WHERE LOWER(Email) = LOWER(%s)", (email,))
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Registration failed: this email is already registered. Please log in or use another email.",
        )

    pw_hash = hash_password(password)
    conn = db.get_connection()
    try:
        cur = conn.cursor()
        sql_user = db._prepare_sql(
            "INSERT INTO Users (Name, Email, Password, Phone) VALUES (%s, %s, %s, %s)"
        )
        cur.execute(sql_user, (name, email, pw_hash, phone or None))
        user_id = cur.lastrowid

        sql_profile = db._prepare_sql(
            "INSERT INTO Profiles (User_id, Profile_name, Is_Kids, Age) VALUES (%s, %s, %s, %s)"
        )
        cur.execute(sql_profile, (user_id, profile_name, 1 if payload.is_kids else 0, payload.age))
        conn.commit()
        cur.close()
    except Exception as exc:
        conn.rollback()
        msg = str(exc)
        if "1062" in msg or "UNIQUE" in msg.upper():
            raise HTTPException(
                status_code=409,
                detail="Registration failed: this email is already registered.",
            )
        raise HTTPException(status_code=500, detail=f"Database error during registration: {exc}")
    finally:
        conn.close()

    user = get_user_or_404(int(user_id))
    profiles = db.query_all(
        "SELECT Profile_id, User_id, Profile_name, Is_Kids, Age FROM Profiles WHERE User_id = %s ORDER BY Profile_id",
        (user["User_id"],),
    )
    for p in profiles:
        p["Is_Kids"] = bool(p.get("Is_Kids"))
    return {
        "message": "User registered successfully.",
        "user": user,
        "profiles": profiles,
        "subscription": None,
    }


@app.get("/api/users")
def list_users():
    return db.query_all(
        "SELECT User_id, Name, Email, Phone, Registration_date FROM Users ORDER BY User_id"
    )


@app.get("/api/users/{user_id}/profiles")
def get_profiles(user_id: int):
    get_user_or_404(user_id)
    profiles = db.query_all(
        "SELECT Profile_id, User_id, Profile_name, Is_Kids, Age FROM Profiles WHERE User_id = %s ORDER BY Profile_id",
        (user_id,),
    )
    for p in profiles:
        p["Is_Kids"] = bool(p.get("Is_Kids"))
    return profiles


@app.post("/api/users/{user_id}/profiles")
def create_profile(user_id: int, payload: CreateProfileRequest):
    get_user_or_404(user_id)
    profile_name = payload.profile_name.strip()
    if not profile_name:
        raise HTTPException(status_code=400, detail="Profile name cannot be empty.")
    profile_id, _ = db.execute(
        "INSERT INTO Profiles (User_id, Profile_name, Is_Kids, Age) VALUES (%s, %s, %s, %s)",
        (user_id, profile_name, 1 if payload.is_kids else 0, payload.age),
    )
    profile = db.query_one(
        "SELECT Profile_id, User_id, Profile_name, Is_Kids, Age FROM Profiles WHERE Profile_id = %s",
        (profile_id,),
    )
    if profile:
        profile["Is_Kids"] = bool(profile.get("Is_Kids"))
    return profile


@app.delete("/api/users/{user_id}/profiles/{profile_id}")
def delete_profile(user_id: int, profile_id: int):
    get_user_or_404(user_id)
    profiles = db.query_all("SELECT Profile_id FROM Profiles WHERE User_id = %s", (user_id,))
    if len(profiles) <= 1:
        raise HTTPException(status_code=400, detail="You must keep at least one profile on your account.")
    _, count = db.execute(
        "DELETE FROM Profiles WHERE Profile_id = %s AND User_id = %s",
        (profile_id, user_id),
    )
    if count == 0:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"deleted": True, "profile_id": profile_id}


@app.get("/api/filters/meta")
def get_filter_meta():
    genres = [r["Genre_name"] for r in db.query_all("SELECT Genre_name FROM Genres ORDER BY Genre_name")]
    languages = [
        r["Language"]
        for r in db.query_all("SELECT DISTINCT Language FROM Content WHERE Language IS NOT NULL ORDER BY Language")
    ]
    years = [
        r["Release_YEAR"]
        for r in db.query_all("SELECT DISTINCT Release_YEAR FROM Content WHERE Release_YEAR IS NOT NULL ORDER BY Release_YEAR DESC")
    ]
    maturities = [
        r["Maturity_rating"]
        for r in db.query_all("SELECT DISTINCT Maturity_rating FROM Content WHERE Maturity_rating IS NOT NULL ORDER BY Maturity_rating")
    ]
    types = [
        r["Type"]
        for r in db.query_all("SELECT DISTINCT Type FROM Content WHERE Type IS NOT NULL ORDER BY Type")
    ]
    return {
        "genres": genres,
        "languages": languages,
        "years": years,
        "maturity_ratings": maturities,
        "types": types,
    }


@app.get("/api/content")
def browse_content(
    q: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
    genre: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    maturity: Optional[str] = Query(default=None),
    kids_only: bool = Query(default=False),
    user_id: Optional[int] = Query(default=None),
):
    sql = """
        SELECT DISTINCT c.Content_id, c.Title, c.Description, c.Release_YEAR,
               c.Duration, c.Type, c.Maturity_rating, c.Language
        FROM Content c
        LEFT JOIN Content_Genres cg ON c.Content_id = cg.Content_id
        LEFT JOIN Genres g ON cg.Genre_id = g.Genre_id
        WHERE 1=1
    """
    params: List[Any] = []
    if type:
        sql += " AND LOWER(c.Type) = LOWER(%s)"
        params.append(type.strip())
    if language:
        sql += " AND LOWER(c.Language) = LOWER(%s)"
        params.append(language.strip())
    if genre:
        sql += " AND LOWER(g.Genre_name) = LOWER(%s)"
        params.append(genre.strip())
    if year is not None:
        sql += " AND c.Release_YEAR = %s"
        params.append(year)
    if maturity:
        sql += " AND LOWER(c.Maturity_rating) = LOWER(%s)"
        params.append(maturity.strip())
    sql += " ORDER BY c.Content_id ASC"

    rows = db.query_all(sql, tuple(params))
    enriched = enrich_content_list(rows, user_id=user_id)

    if kids_only:
        enriched = [
            item
            for item in enriched
            if str(item.get("Maturity_rating") or "").upper() in KIDS_SAFE_RATINGS
        ]

    if q and q.strip():
        needle = q.strip().lower()
        enriched = [
            item
            for item in enriched
            if needle in str(item.get("Title", "")).lower()
            or needle in str(item.get("Description", "")).lower()
            or needle in str(item.get("Language", "")).lower()
            or needle in str(item.get("Type", "")).lower()
            or any(needle in g.lower() for g in item.get("genres", []))
            or any(needle in a.lower() for a in item.get("actors", []))
            or any(needle in d.lower() for d in item.get("directors", []))
        ]

    return enriched


@app.get("/api/content/{content_id}")
def get_content_detail(content_id: int, user_id: Optional[int] = Query(default=None)):
    item = get_content_or_404(content_id)
    enriched = enrich_content_list([item], user_id=user_id)[0]
    reviews = db.query_all(
        """
        SELECT rr.Review_id, rr.User_id, rr.Content_id, rr.Rating, rr.Review_text, rr.Review_date,
               u.Name AS Reviewer_name
        FROM Rating_Reviews rr
        JOIN Users u ON rr.User_id = u.User_id
        WHERE rr.Content_id = %s
        ORDER BY rr.Review_date DESC, rr.Review_id DESC
        """,
        (content_id,),
    )
    enriched["reviews"] = reviews
    return enriched


@app.post("/api/watch")
def update_watch_history(payload: WatchProgressRequest):
    get_user_or_404(payload.user_id)
    get_content_or_404(payload.content_id)

    progress = round(float(payload.progress_percentage), 2)
    completed = 1 if progress >= 100.0 else 0

    existing = db.query_one(
        """
        SELECT History_id FROM Watch_history
        WHERE User_id = %s AND Content_id = %s
        ORDER BY Watch_date DESC, History_id DESC
        LIMIT 1
        """,
        (payload.user_id, payload.content_id),
    )

    if existing:
        db.execute(
            """
            UPDATE Watch_history
            SET Progress_percentage = %s, Completed = %s, Watch_date = CURRENT_TIMESTAMP
            WHERE History_id = %s
            """,
            (progress, completed, existing["History_id"]),
        )
        history_id = existing["History_id"]
    else:
        history_id, _ = db.execute(
            """
            INSERT INTO Watch_history (User_id, Content_id, Progress_percentage, Completed)
            VALUES (%s, %s, %s, %s)
            """,
            (payload.user_id, payload.content_id, progress, completed),
        )

    return {
        "message": "Watch history updated successfully.",
        "History_id": history_id,
        "User_id": payload.user_id,
        "Content_id": payload.content_id,
        "Progress_percentage": progress,
        "Completed": bool(completed),
    }


@app.post("/api/reviews")
def submit_review(payload: ReviewRequest):
    get_user_or_404(payload.user_id)
    get_content_or_404(payload.content_id)

    rating = round(float(payload.rating), 1)
    if rating < 0 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 0 and 5.")

    existing = db.query_one(
        """
        SELECT Review_id FROM Rating_Reviews
        WHERE User_id = %s AND Content_id = %s
        ORDER BY Review_id DESC LIMIT 1
        """,
        (payload.user_id, payload.content_id),
    )

    if existing:
        db.execute(
            """
            UPDATE Rating_Reviews
            SET Rating = %s, Review_text = %s, Review_date = CURRENT_TIMESTAMP
            WHERE Review_id = %s
            """,
            (rating, payload.review_text.strip(), existing["Review_id"]),
        )
        review_id = existing["Review_id"]
        action = "updated"
    else:
        review_id, _ = db.execute(
            """
            INSERT INTO Rating_Reviews (User_id, Content_id, Rating, Review_text)
            VALUES (%s, %s, %s, %s)
            """,
            (payload.user_id, payload.content_id, rating, payload.review_text.strip()),
        )
        action = "created"

    return {
        "message": f"Rating and review {action} successfully.",
        "Review_id": review_id,
        "User_id": payload.user_id,
        "Content_id": payload.content_id,
        "Rating": rating,
        "Review_text": payload.review_text.strip(),
    }


@app.get("/api/plans")
def get_plans():
    return db.query_all(
        """
        SELECT Plan_id, Plan_name, Price, Duration_months, Max_screens, Video_quality
        FROM Subscription_Plans
        ORDER BY Plan_id
        """
    )


@app.post("/api/subscribe")
def subscribe_plan(payload: SubscribeRequest):
    """Exact transactional subscription + payment + FailTest rollback logic from main.py."""
    get_user_or_404(payload.user_id)
    plan = db.query_one(
        "SELECT * FROM Subscription_Plans WHERE Plan_id = %s",
        (payload.plan_id,),
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan ID does not exist.")

    raw_method = payload.method.strip()
    if raw_method.lower() == "failtest":
        method = "FailTest"
    elif raw_method.upper() == "UPI":
        method = "UPI"
    elif raw_method.lower() == "card":
        method = "Card"
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment method. Please choose UPI, Card, or FailTest.",
        )

    start_date = date.today()
    end_date = add_months(start_date, int(plan["Duration_months"]))
    amount = plan["Price"]

    conn = db.get_connection()
    try:
        cur = conn.cursor()
        # Mark older active subscriptions of this user as Expired on upgrade?
        # Wait: main.py simply inserts the new Active subscription in a transaction.
        # Keep exact main.py behavior so both remain 100% consistent!
        sql_sub = db._prepare_sql(
            """
            INSERT INTO Subscriptions (User_id, Plan_id, Start_date, End_date, Status)
            VALUES (%s, %s, %s, %s, 'Active')
            """
        )
        cur.execute(
            sql_sub,
            (payload.user_id, payload.plan_id, start_date.isoformat(), end_date.isoformat()),
        )
        subscription_id = cur.lastrowid

        if method == "FailTest":
            raise RuntimeError("Simulated payment failure: transaction declined.")

        sql_pay = db._prepare_sql(
            """
            INSERT INTO Payments (User_id, Subscription_id, Amount, Method_of_Payment, Status)
            VALUES (%s, %s, %s, %s, 'Success')
            """
        )
        cur.execute(sql_pay, (payload.user_id, subscription_id, amount, method))
        payment_id = cur.lastrowid
        conn.commit()
        cur.close()
    except RuntimeError as exc:
        conn.rollback()
        raise HTTPException(
            status_code=402,
            detail=f"Payment unsuccessful: {exc} The subscription was rolled back; no active subscription was created.",
        )
    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database/payment processing error. Transaction rolled back: {exc}",
        )
    finally:
        conn.close()

    return {
        "message": "Subscription activated successfully!",
        "Subscription_id": subscription_id,
        "Payment_id": payment_id,
        "Plan_name": plan["Plan_name"],
        "Amount": float(amount),
        "Method_of_Payment": method,
        "Start_date": start_date.isoformat(),
        "End_date": end_date.isoformat(),
        "Status": "Active",
    }


@app.get("/api/users/{user_id}/dashboard")
def user_dashboard(user_id: int):
    user = get_user_or_404(user_id)
    subscriptions = db.query_all(
        """
        SELECT s.Subscription_id, s.Plan_id, sp.Plan_name, sp.Price, sp.Video_quality, sp.Max_screens,
               s.Start_date, s.End_date, s.Status
        FROM Subscriptions s
        JOIN Subscription_Plans sp ON s.Plan_id = sp.Plan_id
        WHERE s.User_id = %s
        ORDER BY s.Start_date DESC, s.Subscription_id DESC
        """,
        (user_id,),
    )
    active_sub = get_active_subscription(user_id)

    watch_rows = db.query_all(
        """
        SELECT wh.History_id, wh.Content_id, wh.Progress_percentage, wh.Completed, wh.Watch_date,
               c.Title, c.Description, c.Release_YEAR, c.Duration, c.Type, c.Maturity_rating, c.Language
        FROM Watch_history wh
        JOIN Content c ON wh.Content_id = c.Content_id
        WHERE wh.User_id = %s
        ORDER BY wh.Watch_date DESC, wh.History_id DESC
        """,
        (user_id,),
    )
    # Deduplicate by Content_id keeping most recent watch entry
    seen_cids = set()
    unique_watch = []
    for row in watch_rows:
        row["Completed"] = bool(row.get("Completed"))
        if row["Content_id"] not in seen_cids:
            seen_cids.add(row["Content_id"])
            unique_watch.append(row)

    continue_watching = [r for r in unique_watch if not r["Completed"]]
    completed_history = [r for r in unique_watch if r["Completed"]]

    ratings = db.query_all(
        """
        SELECT rr.Review_id, rr.Content_id, c.Title, c.Type, c.Release_YEAR,
               rr.Rating, rr.Review_text, rr.Review_date
        FROM Rating_Reviews rr
        JOIN Content c ON rr.Content_id = c.Content_id
        WHERE rr.User_id = %s
        ORDER BY rr.Rating DESC, rr.Review_date DESC
        """,
        (user_id,),
    )

    profiles = db.query_all(
        "SELECT Profile_id, User_id, Profile_name, Is_Kids, Age FROM Profiles WHERE User_id = %s ORDER BY Profile_id",
        (user_id,),
    )
    for p in profiles:
        p["Is_Kids"] = bool(p.get("Is_Kids"))

    payments = db.query_all(
        """
        SELECT p.Payment_id, p.Subscription_id, p.Amount, p.Method_of_Payment, p.Status, p.Payment_date,
               sp.Plan_name
        FROM Payments p
        LEFT JOIN Subscriptions s ON p.Subscription_id = s.Subscription_id
        LEFT JOIN Subscription_Plans sp ON s.Plan_id = sp.Plan_id
        WHERE p.User_id = %s
        ORDER BY p.Payment_date DESC, p.Payment_id DESC
        """,
        (user_id,),
    )

    return {
        "user": user,
        "active_subscription": active_sub,
        "subscriptions": subscriptions,
        "continue_watching": continue_watching,
        "completed_history": completed_history,
        "watch_history": unique_watch,
        "ratings": ratings,
        "profiles": profiles,
        "payments": payments,
    }


@app.post("/api/admin/run-scheduler")
def run_scheduler():
    """Matches schema.sql Update_Subscription_Status event & main.py run_scheduler."""
    _, updated = db.execute(
        """
        UPDATE Subscriptions
        SET Status = 'Expired'
        WHERE End_date < CURDATE() AND Status != 'Expired'
        """
    )
    return {
        "message": f"Scheduler completed. {updated} subscription(s) updated to 'Expired'.",
        "updated_count": updated,
    }


@app.post("/api/admin/reset-demo")
def reset_demo():
    db.reset_local_mirror()
    return {"message": "Local SQLite mirror reset to exact data.sql seed state."}


@app.get("/api/admin/filter/{table_name}")
def filter_any_table(
    table_name: str,
    type: Optional[str] = None,
    language: Optional[str] = None,
    genre: Optional[str] = None,
    year: Optional[int] = None,
    maturity: Optional[str] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    profile_name: Optional[str] = None,
    is_kids: Optional[str] = None,
    age: Optional[int] = None,
    plan_name: Optional[str] = None,
    price: Optional[float] = None,
    duration_months: Optional[int] = None,
    max_screens: Optional[int] = None,
    video_quality: Optional[str] = None,
    user_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    status: Optional[str] = None,
    completed: Optional[str] = None,
):
    """Implements all 7 tables from main.py filter_any_table cleanly and safely."""
    t = table_name.lower()
    params: List[Any] = []

    if t == "content":
        sql = """
            SELECT DISTINCT c.Content_id, c.Title, c.Type, c.Language, c.Release_YEAR,
                   c.Maturity_rating, c.Duration
            FROM Content c
            LEFT JOIN Content_Genres cg ON c.Content_id = cg.Content_id
            LEFT JOIN Genres g ON cg.Genre_id = g.Genre_id
            WHERE 1=1
        """
        if type:
            sql += " AND LOWER(c.Type) = LOWER(%s)"
            params.append(type)
        if language:
            sql += " AND LOWER(c.Language) = LOWER(%s)"
            params.append(language)
        if genre:
            sql += " AND LOWER(g.Genre_name) = LOWER(%s)"
            params.append(genre)
        if year is not None:
            sql += " AND c.Release_YEAR = %s"
            params.append(year)
        if maturity:
            sql += " AND LOWER(c.Maturity_rating) = LOWER(%s)"
            params.append(maturity)
        sql += " ORDER BY c.Content_id"
    elif t == "users":
        sql = "SELECT User_id, Name, Email, Phone, Registration_date FROM Users WHERE 1=1"
        if name:
            sql += " AND LOWER(Name) LIKE LOWER(%s)"
            params.append(f"%{name}%")
        if email:
            sql += " AND LOWER(Email) LIKE LOWER(%s)"
            params.append(f"%{email}%")
        if phone:
            sql += " AND Phone LIKE %s"
            params.append(f"%{phone}%")
        sql += " ORDER BY User_id"
    elif t == "profiles":
        sql = "SELECT Profile_id, User_id, Profile_name, Is_Kids, Age FROM Profiles WHERE 1=1"
        if profile_name:
            sql += " AND LOWER(Profile_name) LIKE LOWER(%s)"
            params.append(f"%{profile_name}%")
        if is_kids in ("yes", "no", "true", "false"):
            val = 1 if is_kids in ("yes", "true") else 0
            sql += " AND Is_Kids = %s"
            params.append(val)
        if age is not None:
            sql += " AND Age = %s"
            params.append(age)
        sql += " ORDER BY Profile_id"
    elif t == "subscription_plans":
        sql = "SELECT Plan_id, Plan_name, Price, Duration_months, Max_screens, Video_quality FROM Subscription_Plans WHERE 1=1"
        if plan_name:
            sql += " AND LOWER(Plan_name) LIKE LOWER(%s)"
            params.append(f"%{plan_name}%")
        if price is not None:
            sql += " AND Price = %s"
            params.append(price)
        if duration_months is not None:
            sql += " AND Duration_months = %s"
            params.append(duration_months)
        if max_screens is not None:
            sql += " AND Max_screens = %s"
            params.append(max_screens)
        if video_quality:
            sql += " AND LOWER(Video_quality) = LOWER(%s)"
            params.append(video_quality)
        sql += " ORDER BY Plan_id"
    elif t == "subscriptions":
        sql = "SELECT Subscription_id, User_id, Plan_id, Start_date, End_date, Status FROM Subscriptions WHERE 1=1"
        if user_id is not None:
            sql += " AND User_id = %s"
            params.append(user_id)
        if plan_id is not None:
            sql += " AND Plan_id = %s"
            params.append(plan_id)
        if status:
            sql += " AND LOWER(Status) = LOWER(%s)"
            params.append(status)
        sql += " ORDER BY Subscription_id"
    elif t == "payments":
        sql = "SELECT Payment_id, User_id, Subscription_id, Amount, Method_of_Payment, Status, Payment_date FROM Payments WHERE 1=1"
        if user_id is not None:
            sql += " AND User_id = %s"
            params.append(user_id)
        if status:
            sql += " AND LOWER(Status) = LOWER(%s)"
            params.append(status)
        sql += " ORDER BY Payment_id"
    elif t == "watch_history":
        sql = "SELECT History_id, User_id, Content_id, Progress_percentage, Completed, Watch_date FROM Watch_history WHERE 1=1"
        if user_id is not None:
            sql += " AND User_id = %s"
            params.append(user_id)
        if completed in ("yes", "no", "true", "false"):
            val = 1 if completed in ("yes", "true") else 0
            sql += " AND Completed = %s"
            params.append(val)
        sql += " ORDER BY History_id"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown table: {table_name}")

    rows = db.query_all(sql, tuple(params))
    return {"table": t, "count": len(rows), "rows": rows}


# -------------------- Static Frontend Serving --------------------
posters_dir = BASE_DIR / "posters"
posters_dir.mkdir(parents=True, exist_ok=True)
app.mount("/posters", StaticFiles(directory=str(posters_dir)), name="posters")


@app.get("/")
def serve_index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/styles.css")
def serve_styles():
    return FileResponse(BASE_DIR / "styles.css")


@app.get("/app.js")
def serve_js():
    return FileResponse(BASE_DIR / "app.js")


@app.get("/manifest.json")
def serve_manifest():
    return FileResponse(BASE_DIR / "manifest.json")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    print(f"Starting Netflix OTT Frontend on http://localhost:{port} (DB mode: {db.mode})")
    if db.mysql_error:
        print(f"Note: {db.mysql_error}")
    uvicorn.run(app, host="0.0.0.0", port=port)
